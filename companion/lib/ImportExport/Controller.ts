/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'node:events'
import type express from 'express'
import { nanoid } from 'nanoid'
import workerPool from 'workerpool'
import z from 'zod'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ExportFullv6, ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import {
	zodClientImportOrResetSelection,
	type ClientImportObject,
	type ClientImportOrResetSelection,
	type ClientPageInfo,
	type ImportExportTask,
	type ImportExportTaskType,
	type ImportOrResetType,
} from '@companion-app/shared/Model/ImportExport.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import type {
	ButtonGraphicsReferenceElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { ControlsController } from '../Controls/Controller.js'
import { CreateElementOfType } from '../Controls/ControlTypes/Button/LayerDefaults.js'
import { pageDownElements } from '../Controls/ControlTypes/PageDown.js'
import { pageNumberElements } from '../Controls/ControlTypes/PageNumber.js'
import { pageUpElements } from '../Controls/ControlTypes/PageUp.js'
import type { DataDatabase } from '../Data/Database.js'
import { upgradeImport } from '../Data/Upgrade.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../Graphics/ConvertGraphicsElements.js'
import { PREVIEW_RENDER_SIZE } from '../Graphics/ImageResult.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import LogController from '../Log/Controller.js'
import type { PageController } from '../Page/Controller.js'
import { zodLocation } from '../Preview/Graphics.js'
import type { AppInfo } from '../Registry.js'
import { MultipartUploader } from '../Resources/MultipartUploader.js'
import { resolveThreadEntrypoint } from '../Resources/Util.js'
import type { SurfaceController } from '../Surface/Controller.js'
import { publicProcedure, router, toIterable, type TrpcContext } from '../UI/TRPC.js'
import type { VariablesController } from '../Variables/Controller.js'
import { BackupController } from './Backups.js'
import { FILE_VERSION, MAX_IMPORT_FILE_SIZE } from './Constants.js'
import { ExportController } from './Export.js'
import { ImportController } from './Import.js'
import { parseImportBuffer, type ParseImportResult } from './ParseImport.js'
import type { ImportExportThreadMethods } from './ThreadMethods.js'
import { find_smallest_grid_for_page } from './Util.js'

export class ImportExportController {
	readonly #logger = LogController.createLogger('ImportExport/Controller')

	readonly #controlsController: ControlsController
	readonly #graphicsController: GraphicsController
	readonly #instancesController: InstanceController
	readonly #pagesController: PageController
	readonly #surfacesController: SurfaceController
	readonly #userConfigController: DataUserConfig
	readonly #variablesController: VariablesController
	readonly #backupController: BackupController

	readonly #exportController: ExportController
	readonly #importController: ImportController

	// JSON is parsed on the main thread (streamed), so the worker is only used for YAML - which has
	// no streaming parser and would otherwise block the event loop. Lazy (minWorkers: 0) so no idle
	// thread lingers: it is spawned on demand for a YAML import and terminated when idle.
	#pool = workerPool.pool(resolveThreadEntrypoint(import.meta.dirname, 'ImportExportThread.js'), {
		minWorkers: 0,
		maxWorkers: 1, // Only need one worker for import parsing
		workerType: 'thread',
		onCreateWorker: () => {
			this.#logger.info('ImportExport worker created')
			return undefined
		},
		onTerminateWorker: () => {
			this.#logger.info('ImportExport worker terminated')
		},
	})

	#poolExec = async <TKey extends keyof typeof ImportExportThreadMethods>(
		key: TKey,
		args: Parameters<(typeof ImportExportThreadMethods)[TKey]>,
		transfer?: object[]
	): Promise<ReturnType<(typeof ImportExportThreadMethods)[TKey]>> => {
		return this.#pool.exec(key, args, {
			transfer: transfer || [],
		})
	}

	/** Parse YAML in the worker thread so a large synchronous parse never blocks the event loop. */
	readonly #parseYamlInWorker = async (buffer: Buffer, gz: boolean): Promise<ParseImportResult> => {
		// Transfer the bytes to the worker. When the Buffer owns its whole backing store - the usual
		// case, since MultipartUploader uses Buffer.alloc - the ArrayBuffer is moved with no copy;
		// otherwise fall back to copying the slice out. Either way `buffer` is not used again.
		const ownsWholeBuffer = buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength
		const arrayBuffer = ownsWholeBuffer
			? (buffer.buffer as ArrayBuffer)
			: (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)
		return this.#poolExec('parseImportData', [arrayBuffer, gz], [arrayBuffer])
	}

	readonly #multipartUploader = new MultipartUploader<[string | null, ClientImportObject | null], null>(
		'ImportExport/Controller',
		MAX_IMPORT_FILE_SIZE,
		async (_name, data, _userData, _updateProgress, sessionCtx) => {
			// JSON (plain or gz) is stream-parsed on the main thread - never held as a single giant
			// string, and no worker->main IPC copy. YAML is parsed in the worker (see #parseYamlInWorker).
			this.#logger.info(`Import: Parsing ${data.byteLength} bytes`)

			const parseStartTime = performance.now()
			const result = await parseImportBuffer(data, this.#parseYamlInWorker)
			this.#logger.info(`Import: Parsing complete in ${(performance.now() - parseStartTime).toFixed(1)}ms`)

			if (result.error) {
				return [result.error, null]
			}

			return this.#buildClientImportObject(result.data, sessionCtx)
		},
		z.null()
	)

	/**
	 * Upgrade a freshly-parsed import object, store it on the session as the pending import, and build
	 * the minimal summary object sent back to the client.
	 */
	#buildClientImportObject(rawObject: unknown, sessionCtx: TrpcContext): [string | null, ClientImportObject | null] {
		let importObject = upgradeImport(rawObject, this.#userConfigController.getAll())

		// fix any db instances missing the upgradeIndex property
		if (importObject.instances) {
			for (const connectionConfig of Object.values(importObject.instances)) {
				if (connectionConfig) {
					connectionConfig.lastUpgradeIndex = connectionConfig.lastUpgradeIndex ?? -1
				}
			}
		}

		if (importObject.type === 'trigger_list') {
			importObject = {
				type: 'full',
				version: FILE_VERSION,
				companionBuild: importObject.companionBuild,
				triggers: importObject.triggers,
				triggerCollections: importObject.triggerCollections,
				instances: importObject.instances,
				connectionCollections: importObject.connectionCollections,
			} satisfies ExportFullv6
		}

		// Store the object on the client
		sessionCtx.pendingImport = {
			object: importObject,
			timeout: null, // TODO
		}

		const importContainsKey = (key: keyof (ExportFullv6 & ExportPageContentv6)): boolean =>
			key in importObject && Object.keys(importObject[key as keyof typeof importObject] || {}).length > 0

		// Build a minimal object to send back to the client
		const clientObject: ClientImportObject = {
			type: importObject.type,
			connections: {},
			buttons: 'pages' in importObject,
			customVariables: importContainsKey('custom_variables'),
			expressionVariables: importContainsKey('expressionVariables'),
			surfacesKnown: importContainsKey('surfaces') || importContainsKey('surfaceGroups'),
			surfacesInstances: importContainsKey('surfaceInstances'),
			surfacesRemote: importContainsKey('surfacesRemote'),
			triggers: null,
			imageLibrary: importContainsKey('imageLibrary'),
		}

		for (const [connectionId, connectionConfig] of Object.entries(importObject.instances || {})) {
			if (!connectionConfig || connectionId === 'internal' || connectionId === 'bitfocus-companion') continue

			clientObject.connections[connectionId] = {
				moduleId: connectionConfig.moduleId,
				moduleVersionId: connectionConfig.moduleVersionId ?? null,
				label: connectionConfig.label,
				sortOrder: connectionConfig.sortOrder,
			}
		}

		function simplifyPageForClient(pageInfo: ExportPageContentv6): ClientPageInfo {
			return {
				name: pageInfo.name,
				gridSize: find_smallest_grid_for_page(pageInfo),
			}
		}

		if (importObject.type === 'page') {
			clientObject.page = simplifyPageForClient(importObject.page)
			clientObject.oldPageNumber = importObject.oldPageNumber || 1
		} else {
			if (importObject.pages) {
				clientObject.pages = Object.fromEntries(
					Object.entries(importObject.pages).map(([id, pageInfo]) => [id, simplifyPageForClient(pageInfo)])
				)
			}

			// Simplify triggers
			if (importObject.triggers && Object.keys(importObject.triggers).length > 0) {
				clientObject.triggers = {}

				for (const [id, trigger] of Object.entries(importObject.triggers)) {
					clientObject.triggers[id] = {
						name: trigger.options.name,
					}
				}
			}
		}

		// rest is done from browser
		return [null, clientObject]
	}

	/**
	 * The current or most-recently-completed import/reset task, published to clients on the subscription.
	 * A completed task is retained (so a client can observe the outcome of the run it started) until the
	 * next task begins.
	 */
	#currentImportTask: ImportExportTask | null = null

	readonly #taskEvents = new EventEmitter<{ taskChange: [status: ImportExportTask | null] }>()

	constructor(
		appInfo: AppInfo,
		apiRouter: express.Router,
		db: DataDatabase,
		controls: ControlsController,
		graphics: GraphicsController,
		instance: InstanceController,
		internalModule: InternalController,
		page: PageController,
		surfaces: SurfaceController,
		userconfig: DataUserConfig,
		variablesController: VariablesController
	) {
		this.#controlsController = controls
		this.#graphicsController = graphics
		this.#instancesController = instance
		this.#pagesController = page
		this.#surfacesController = surfaces
		this.#userConfigController = userconfig
		this.#variablesController = variablesController

		this.#taskEvents.setMaxListeners(0)

		this.#exportController = new ExportController(
			appInfo,
			apiRouter,
			controls,
			graphics,
			instance,
			page.store,
			surfaces,
			userconfig,
			variablesController
		)
		this.#importController = new ImportController(
			controls,
			graphics,
			instance,
			internalModule,
			page,
			surfaces,
			userconfig,
			variablesController
		)

		// Initialize the backup controller
		this.#backupController = new BackupController(
			appInfo,
			db,
			this.#userConfigController,
			variablesController.values,
			this.#exportController
		)

		// Initialize with current user config for backups
		const backupRules = this.#userConfigController.getKey('backups')
		this.#backupController.initializeWithConfig(backupRules || [])
	}

	/**
	 * Mark a task as started, publishing it (with its runId) on the task status subscription.
	 * Returns the runId, which the triggering mutation hands to the client so it can track this run.
	 */
	#beginTask(newTaskType: ImportExportTaskType): string {
		if (this.#currentImportTask?.status === 'running') throw new Error('Another operation is in progress')

		const runId = nanoid()
		this.#currentImportTask = { type: newTaskType, runId, status: 'running' }
		this.#taskEvents.emit('taskChange', this.#currentImportTask)

		return runId
	}

	/** Mark a task as finished, recording its outcome so a client can observe completion via the subscription. */
	#endTask(task: ImportExportTaskType, runId: string, error: string | null): void {
		this.#currentImportTask = { type: task, runId, status: 'completed', error }
		this.#taskEvents.emit('taskChange', this.#currentImportTask)
	}

	async #checkOrRunImportTask<T>(newTaskType: ImportExportTaskType, executeFn: () => Promise<T>): Promise<T> {
		const runId = this.#beginTask(newTaskType)

		try {
			const result = await executeFn()
			this.#endTask(newTaskType, runId, null)
			return result
		} catch (e) {
			this.#endTask(newTaskType, runId, stringifyError(e))
			throw e
		}
	}

	/**
	 * Start a task that runs in the background, rather than for the duration of the triggering RPC call.
	 * The task status subscription reports the running task (with its runId) and its eventual outcome, so
	 * a client tracks the run there: bounded wait for it to appear as running, then an unbounded wait for
	 * completion. This avoids a long-running import holding the RPC socket open - if that socket drops
	 * mid-import (which a large import can trigger) the client would otherwise see a spurious failure even
	 * though the import committed successfully.
	 */
	#startDeferredTask(newTaskType: ImportExportTaskType, executeFn: () => Promise<void>): string {
		const runId = this.#beginTask(newTaskType)

		Promise.resolve()
			.then(executeFn)
			.then(
				() => this.#endTask(newTaskType, runId, null),
				(e) => {
					this.#logger.error(`${newTaskType} task failed: ${stringifyError(e)}`)
					this.#endTask(newTaskType, runId, stringifyError(e))
				}
			)

		return runId
	}

	createTrpcRouter() {
		const self = this
		return router({
			prepareImport: this.#multipartUploader.createTrpcRouter(),
			backupRules: this.#backupController.createTrpcRouter(),

			importExportTaskStatus: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#taskEvents, 'taskChange', signal)

				yield self.#currentImportTask

				for await (const [change] of changes) {
					yield change
				}
			}),

			abort: publicProcedure.mutation(async ({ ctx }) => {
				// Clear the pending import
				delete ctx.pendingImport
			}),

			resetConfiguration: publicProcedure
				.input(z.object({ config: zodClientImportOrResetSelection }))
				.mutation(async ({ input, ctx }) => {
					// Make sure no import is pending
					delete ctx.pendingImport

					return this.#checkOrRunImportTask('reset', async () => {
						return this.#reset(input.config)
					})
				}),

			controlPreview: publicProcedure
				.input(
					z.object({
						location: zodLocation,
					})
				)
				.query(async ({ input, ctx }) => {
					const importObject = ctx.pendingImport?.object
					if (!importObject) return null

					let importPage: ExportPageContentv6 | undefined
					if (importObject.type === 'page') {
						importPage = importObject.page
					} else if (importObject.type === 'full') {
						importPage = importObject.pages?.[input.location.pageNumber]
					}
					if (!importPage) return null

					const controlObj = importPage.controls?.[input.location.row]?.[input.location.column]
					if (!controlObj) return null

					const controlObjLayered = controlObj as SomeButtonModel

					let drawType: RendererButtonStyle['drawType']
					let rawElements: SomeButtonGraphicsElement[]
					switch (controlObjLayered.type) {
						case 'button-layered':
						case 'preset-reference':
							drawType = 'button'
							rawElements = controlObjLayered.style.layers
							break
						case 'button-reference': {
							// The mirror is drawn as a single reference element. Cross-page references can't be resolved
							// in the import preview (no render cache), so this renders the "unresolved" placeholder.
							drawType = 'button'
							const referenceElement = CreateElementOfType('reference') as ButtonGraphicsReferenceElement
							referenceElement.location = controlObjLayered.options.location
							rawElements = [referenceElement]
							break
						}
						case 'pagenum':
							drawType = 'pagenum'
							rawElements = structuredClone(pageNumberElements)
							break
						case 'pageup':
							drawType = 'pageup'
							rawElements = structuredClone(pageUpElements)
							break
						case 'pagedown':
							drawType = 'pagedown'
							rawElements = structuredClone(pageDownElements)
							break
						default:
							assertNever(controlObjLayered)
							return null
					}

					const parser = this.#variablesController.values.createVariablesAndExpressionParser(null, null, null, null)

					// Compute the new drawing
					const { elements } = await ConvertSomeButtonGraphicsElementForDrawing(
						this.#instancesController.definitions,
						parser,
						this.#graphicsController.renderPixelBuffers.bind(this.#graphicsController),
						rawElements,
						new Map(),
						true,
						null, // Future: we should be able to resolve references within this import ui, but it needs some thought on how to cache and resolve cross-page references
						null,
						null
					)

					const res = this.#graphicsController.generatePreviewImage(drawType, elements)
					if (!res?.style) return null
					return await res.drawNativeEncoded(PREVIEW_RENDER_SIZE, PREVIEW_RENDER_SIZE, null, 'png')
				}),

			importSinglePage: publicProcedure
				.input(
					z.object({
						targetPage: z.number().int().min(1).or(z.literal(-1)), // -1 means add a new page at the end
						sourcePage: z.number().int().min(1),
						connectionIdRemapping: z.record(z.string(), z.string().optional()),
					})
				)
				.mutation(async ({ input, ctx }) => {
					return this.#checkOrRunImportTask('import', async () => {
						const data = ctx.pendingImport?.object
						if (!data) throw new Error('No in-progress import object')

						let topage = input.targetPage
						let frompage = input.sourcePage

						if (topage === -1) {
							// Add a new page at the end
							const currentPageCount = this.#pagesController.store.getPageCount()
							topage = currentPageCount + 1
							this.#pagesController.insertPages(topage, ['Importing Page'])
						} else {
							const oldPageInfo = this.#pagesController.store.getPageInfo(topage, false)
							if (!oldPageInfo) throw new Error('Invalid target page')
						}

						let pageInfo: ExportPageContentv6

						if (data.type === 'full' && data.pages) {
							pageInfo = data.pages[frompage]

							// continue below
						} else if (data.type === 'page') {
							pageInfo = data.page

							frompage = data.oldPageNumber || 1

							// continue below
						} else {
							throw new Error('Cannot import page ')
						}

						if (!pageInfo) throw new Error(`No matching page to import`)

						return this.#importController.importSinglePage(
							data.instances,
							input.connectionIdRemapping,
							pageInfo,
							topage
						)
					})
				}),

			importTriggers: publicProcedure
				.input(
					z.object({
						selectedTriggerIds: z.array(z.string()),
						connectionIdRemapping: z.record(z.string(), z.string().optional()),
						replaceExisting: z.boolean(),
					})
				)
				.mutation(async ({ input, ctx }) => {
					return this.#checkOrRunImportTask('import', async () => {
						const data = ctx.pendingImport?.object
						if (!data) throw new Error('No in-progress import object')

						if (data.type === 'page' || !data.triggers) throw new Error('No triggers in import')

						return this.#importController.importTriggers(
							data.instances,
							input.connectionIdRemapping,
							data.triggers,
							input.selectedTriggerIds,
							input.replaceExisting
						)
					})
				}),

			importFull: publicProcedure
				.input(z.object({ config: zodClientImportOrResetSelection }))
				.mutation(async ({ input: { config }, ctx }) => {
					const isPartialReset =
						Object.values(config).some((val) => val === 'unchanged') ||
						Object.values(config.surfaces).some((val) => val === 'unchanged')

					this.#logger.info(
						`Performing full import: ${isPartialReset ? 'Partial Reset' : 'Full Reset'} Config: ${JSON.stringify(config)}`
					)
					const data = ctx.pendingImport?.object
					if (!data) throw new Error('No in-progress import object')

					if (data.type !== 'full') throw new Error('Invalid import object')

					// A full import is potentially long-running, so run it as a deferred task rather than
					// holding this RPC open for its whole duration. The client awaits completion via the
					// task status subscription using the returned runId.
					const runId = this.#startDeferredTask('import', async () => {
						// Destroy old stuff
						await this.#reset(config)

						// Perform the import
						await this.#importController.importFull(data, config)

						// trigger startup triggers to run
						setImmediate(() => {
							this.#controlsController.triggerEvents.emit('startup')
						})
					})

					return { runId }
				}),
		})
	}

	/**
	 * Perform a reset according to the given configuration
	 * Note: sections are reset if the corresponding value in the config is not 'unchanged'.
	 * As this function does not do any importing, `reset-and-import` is treated the same as `reset`
	 */
	async #reset(config: ClientImportOrResetSelection): Promise<'ok'> {
		const shouldReset = (value: ImportOrResetType): boolean => value !== 'unchanged'
		const isImporting = (value: ImportOrResetType): boolean => value === 'reset-and-import'

		if (shouldReset(config.buttons)) {
			this.#controlsController.deleteAllControlsOfType('bank')

			// Reset page 1
			this.#pagesController.resetPage(1) // Note: controls were already deleted above
			if (!isImporting(config.buttons)) {
				// If not importing buttons, recreate the nav buttons
				this.#pagesController.createPageDefaultNavButtons(1)
			}
			this.#graphicsController.clearAllForPage(1)

			// Delete other pages
			const pageCount = this.#pagesController.store.getPageCount()
			for (let pageNumber = pageCount; pageNumber >= 2; pageNumber--) {
				this.#pagesController.deletePage(pageNumber) // Note: controls were already deleted above
			}

			// reset the size
			this.#userConfigController.resetKey('gridSize')
		}

		if (shouldReset(config.connections)) {
			await this.#instancesController.deleteAllConnections(true)
		}

		if (shouldReset(config.surfaces.known)) {
			await this.#surfacesController.reset()
		}

		if (shouldReset(config.surfaces.instances)) {
			await this.#instancesController.deleteAllSurfaceInstances(true)

			if (!isImporting(config.surfaces.instances)) {
				this.#instancesController.createDefaultSurfaceInstances()
			}
		}

		if (shouldReset(config.surfaces.remote)) {
			this.#surfacesController.outbound.reset()
		}

		if (shouldReset(config.triggers)) {
			this.#controlsController.deleteAllControlsOfType('trigger')
			this.#controlsController.replaceTriggerCollections([])
		}

		if (shouldReset(config.customVariables)) {
			this.#variablesController.custom.reset()
		}

		if (shouldReset(config.expressionVariables)) {
			this.#controlsController.replaceExpressionVariableCollections([])
			this.#controlsController.deleteAllControlsOfType('expression-variable')
		}

		if (shouldReset(config.userconfig)) {
			this.#userConfigController.reset()
		}

		if (shouldReset(config.imageLibrary)) {
			// Reset image library
			this.#graphicsController.imageLibrary.resetImageLibrary()
		}

		return 'ok'
	}
}
