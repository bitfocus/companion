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

import { upgradeImport } from '../Data/Upgrade.js'
import yaml from 'yaml'
import zlib from 'node:zlib'
import type express from 'express'
import type { ExportFullv6, ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { AppInfo } from '../Registry.js'
import {
	zodClientImportSelection,
	zodClientResetSelection,
	type ClientImportObject,
	type ClientPageInfo,
	type ClientResetSelection,
} from '@companion-app/shared/Model/ImportExport.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import { ExportController } from './Export.js'
import { FILE_VERSION } from './Constants.js'
import { MultipartUploader } from '../Resources/MultipartUploader.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { zodLocation } from '../Preview/Graphics.js'
import z from 'zod'
import { EventEmitter } from 'node:events'
import { BackupController } from './Backups.js'
import type { DataDatabase } from '../Data/Database.js'
import { ImportController } from './Import.js'
import { find_smallest_grid_for_page } from './Util.js'

const MAX_IMPORT_FILE_SIZE = 1024 * 1024 * 500 // 500MB. This is small enough that it can be kept in memory

export class ImportExportController {
	// readonly #logger = LogController.createLogger('ImportExport/Controller')

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

	readonly #multipartUploader = new MultipartUploader<[string | null, ClientImportObject | null]>(
		'ImportExport/Controller',
		MAX_IMPORT_FILE_SIZE,
		async (_name, data, _updateProgress, sessionCtx) => {
			let dataStr: string
			try {
				dataStr = await new Promise((resolve, reject) => {
					zlib.gunzip(data, (err, data) => {
						if (err) reject(err)
						else resolve(data?.toString() || dataStr)
					})
				})
			} catch (_e) {
				// Ignore, it is probably not compressed
				dataStr = data.toString('utf-8')
			}

			let rawObject
			try {
				// YAML parser will handle JSON too
				rawObject = yaml.parse(dataStr)
			} catch (_e) {
				return ['File is corrupted or unknown format', null]
			}

			if (rawObject.version > FILE_VERSION) {
				return ['File was saved with a newer unsupported version of Companion', null]
			}

			if (rawObject.type !== 'full' && rawObject.type !== 'page' && rawObject.type !== 'trigger_list') {
				return ['Unknown import type', null]
			}

			let object = upgradeImport(rawObject)

			// fix any db instances missing the upgradeIndex property
			if (object.instances) {
				for (const connectionConfig of Object.values(object.instances)) {
					if (connectionConfig) {
						connectionConfig.lastUpgradeIndex = connectionConfig.lastUpgradeIndex ?? -1
					}
				}
			}

			if (object.type === 'trigger_list') {
				object = {
					type: 'full',
					version: FILE_VERSION,
					companionBuild: object.companionBuild,
					triggers: object.triggers,
					triggerCollections: object.triggerCollections,
					instances: object.instances,
					connectionCollections: object.connectionCollections,
				} satisfies ExportFullv6
			}

			// Store the object on the client
			sessionCtx.pendingImport = {
				object,
				timeout: null, // TODO
			}

			// Build a minimal object to send back to the client
			const clientObject: ClientImportObject = {
				type: object.type,
				instances: {},
				controls: 'pages' in object,
				customVariables: 'custom_variables' in object,
				expressionVariables: 'expressionVariables' in object,
				surfaces: 'surfaces' in object,
				triggers: 'triggers' in object,
			}

			for (const [connectionId, connectionConfig] of Object.entries(object.instances || {})) {
				if (!connectionConfig || connectionId === 'internal' || connectionId === 'bitfocus-companion') continue

				clientObject.instances[connectionId] = {
					instance_type: connectionConfig.instance_type,
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

			if (object.type === 'page') {
				clientObject.page = simplifyPageForClient(object.page)
				clientObject.oldPageNumber = object.oldPageNumber || 1
			} else {
				if (object.pages) {
					clientObject.pages = Object.fromEntries(
						Object.entries(object.pages).map(([id, pageInfo]) => [id, simplifyPageForClient(pageInfo)])
					)
				}

				// Simplify triggers
				if (object.triggers) {
					clientObject.triggers = {}

					for (const [id, trigger] of Object.entries(object.triggers)) {
						clientObject.triggers[id] = {
							name: trigger.options.name,
						}
					}
				}
			}

			// rest is done from browser
			return [null, clientObject]
		}
	)

	/**
	 * If there is a current import task that clients should be aware of, this will be set
	 */
	#currentImportTask: 'reset' | 'import' | null = null

	readonly #taskEvents = new EventEmitter<{ taskChange: [status: 'reset' | 'import' | null] }>()

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

	async #checkOrRunImportTask<T>(newTaskType: 'reset' | 'import', executeFn: () => Promise<T>): Promise<T> {
		if (this.#currentImportTask) throw new Error('Another operation is in progress')

		this.#currentImportTask = newTaskType
		this.#taskEvents.emit('taskChange', this.#currentImportTask)

		try {
			return await executeFn()
		} finally {
			this.#currentImportTask = null
			this.#taskEvents.emit('taskChange', this.#currentImportTask)
		}
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

			resetConfiguration: publicProcedure.input(zodClientResetSelection).mutation(async ({ input, ctx }) => {
				// Make sure no import is pending
				delete ctx.pendingImport

				return this.#checkOrRunImportTask('reset', async () => {
					return this.#reset(input)
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

					let importPage
					if (importObject.type === 'page') {
						importPage = importObject.page
					} else if (importObject.type === 'full') {
						importPage = importObject.pages?.[input.location.pageNumber]
					}
					if (!importPage) return null

					const controlObj = importPage.controls?.[input.location.row]?.[input.location.column]
					if (!controlObj) return null

					const res = await this.#graphicsController.drawPreview({
						...controlObj.style,
						style: controlObj.type,
					})
					return res?.style ? (res?.asDataUrl ?? null) : null
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

			importAndResetCustom: publicProcedure
				.input(z.object({ config: zodClientImportSelection }))
				.mutation(async ({ input: { config }, ctx }) => {
					return this.#checkOrRunImportTask('import', async () => {
						console.log(
							`Performing full import: ${fullReset ? 'Full Reset' : 'Partial Reset'} Config: ${JSON.stringify(config)}`
						)
						const data = ctx.pendingImport?.object
						if (!data) throw new Error('No in-progress import object')

						if (data.type !== 'full') throw new Error('Invalid import object')

						// `config` tells what to load. Ensure that config is false for missing sections:
						// note: this is failsafe is not strictly necessary, since Full.tsx does it right, now.
						// note that config doesn't have a entries for 'connections' or 'userconfig'...
						for (const key in config) {
							let dataKey = key.replace(/^customVariables$/, 'custom_variables')
							dataKey = dataKey.replace(/^buttons$/, 'pages')
							config[key as keyof typeof config] &&= dataKey in data
						}

						// Add fields missing from config
						// If partial import, dont ever reset connections (or userconfig until added to UI)
						const resetArg: ClientResetSelection | null = fullReset
							? null
							: { ...config, connections: false, userconfig: false }

						// Destroy old stuff
						await this.#reset(resetArg, config.buttons)

						// Perform the import
						this.#importController.importFull(data, config, !!resetArg && !resetArg.connections)

						// trigger startup triggers to run
						setImmediate(() => {
							this.#controlsController.triggers.emit('startup')
						})
					})
				}),
		})
	}

	async #reset(config: ClientResetSelection | null, skipNavButtons = false): Promise<'ok'> {
		const controls = this.#controlsController.getAllControls()

		if (!config || config.buttons) {
			for (const [controlId, control] of controls.entries()) {
				if (control.type !== 'trigger') {
					this.#controlsController.deleteControl(controlId)
				}
			}

			// Reset page 1
			this.#pagesController.resetPage(1) // Note: controls were already deleted above
			if (!skipNavButtons) {
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

		if (!config || config.connections) {
			await this.#instancesController.deleteAllConnections(true)
		}

		if (!config || config.surfaces) {
			await this.#surfacesController.reset()
		}

		if (!config || config.triggers) {
			for (const [controlId, control] of controls.entries()) {
				if (control.type === 'trigger') {
					this.#controlsController.deleteControl(controlId)
				}
			}
			this.#controlsController.replaceTriggerCollections([])
		}

		if (!config || config.customVariables) {
			this.#variablesController.custom.reset()
		}

		if (!config || config.expressionVariables) {
			this.#controlsController.replaceExpressionVariableCollections([])

			// Delete existing expression variables
			const existingExpressionVariables = this.#controlsController.getAllExpressionVariables()
			for (const control of existingExpressionVariables) {
				this.#controlsController.deleteControl(control.controlId)
			}
		}

		if (!config || config.userconfig) {
			this.#userConfigController.reset()
		}

		return 'ok'
	}
}
