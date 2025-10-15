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
import { cloneDeep } from 'lodash-es'
import {
	CreateExpressionVariableControlId,
	CreateTriggerControlId,
	validateActionSetId,
} from '@companion-app/shared/ControlId.js'
import yaml from 'yaml'
import zlib from 'node:zlib'
import LogController from '../Log/Controller.js'
import { VisitorReferencesUpdater } from '../Resources/Visitors/ReferencesUpdater.js'
import { nanoid } from 'nanoid'
import type express from 'express'
import type {
	ExportControlv6,
	ExportFullv6,
	ExportInstancesv6,
	ExportPageContentv6,
	ExportTriggerContentv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { AppInfo } from '../Registry.js'
import {
	zodClientImportSelection,
	zodClientResetSelection,
	type ClientImportObject,
	type ClientPageInfo,
	type ClientResetSelection,
	type ConnectionRemappings,
} from '@companion-app/shared/Model/ImportExport.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { ActionSetsModel } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { ExportController } from './Export.js'
import { FILE_VERSION } from './Constants.js'
import { MultipartUploader } from '../Resources/MultipartUploader.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { zodLocation } from '../Preview/Graphics.js'
import z from 'zod'
import { EventEmitter } from 'node:events'
import { BackupController } from './Backups.js'
import type { DataDatabase } from '../Data/Database.js'
import { SurfaceConfig, SurfaceGroupConfig } from '@companion-app/shared/Model/Surfaces.js'
import { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

const MAX_IMPORT_FILE_SIZE = 1024 * 1024 * 500 // 500MB. This is small enough that it can be kept in memory

const find_smallest_grid_for_page = (pageInfo: ExportPageContentv6): UserConfigGridSize => {
	const gridSize: UserConfigGridSize = {
		minColumn: 0,
		maxColumn: 7,
		minRow: 0,
		maxRow: 3,
	}

	// Scan through the data in the export, to find the minimum possible grid size
	for (const [row0, rowObj] of Object.entries(pageInfo.controls || {})) {
		const row = Number(row0)
		let foundControl = false

		for (const column0 of Object.keys(rowObj)) {
			const column = Number(column0)

			if (!rowObj[column]) continue
			foundControl = true

			if (column < gridSize.minColumn) gridSize.minColumn = column
			if (column > gridSize.maxColumn) gridSize.maxColumn = column
		}

		if (foundControl) {
			if (row < gridSize.minRow) gridSize.minRow = row
			if (row > gridSize.maxRow) gridSize.maxRow = row
		}
	}

	return gridSize
}

export class ImportExportController {
	readonly #logger = LogController.createLogger('ImportExport/Controller')

	readonly #controlsController: ControlsController
	readonly #graphicsController: GraphicsController
	readonly #instancesController: InstanceController
	readonly #internalModule: InternalController
	readonly #pagesController: PageController
	readonly #surfacesController: SurfaceController
	readonly #userConfigController: DataUserConfig
	readonly #variablesController: VariablesController
	readonly #backupController: BackupController

	readonly #exportController: ExportController

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
		this.#internalModule = internalModule
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
						targetPage: z.number().int().min(1),
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

						let pageInfo

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

						// Setup the new instances
						const instanceIdMap = this.#importInstances(data.instances, input.connectionIdRemapping)

						// Cleanup the old page
						const discardedControlIds = this.#pagesController.resetPage(topage)
						for (const controlId of discardedControlIds) {
							this.#controlsController.deleteControl(controlId)
						}
						this.#graphicsController.clearAllForPage(topage)

						this.#performPageImport(pageInfo, topage, instanceIdMap)

						// Report the used remap to the ui, for future imports
						const instanceRemap2: ConnectionRemappings = {}
						for (const [id, obj] of Object.entries(instanceIdMap)) {
							instanceRemap2[id] = obj.id
						}

						return instanceRemap2
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

						// Remove existing triggers
						if (input.replaceExisting) {
							const controls = this.#controlsController.getAllControls()
							for (const [controlId, control] of controls.entries()) {
								if (control.type === 'trigger') {
									this.#controlsController.deleteControl(controlId)
								}
							}
						}

						// Setup the new instances
						const instanceIdMap = this.#importInstances(data.instances, input.connectionIdRemapping)

						const idsToImport = new Set(input.selectedTriggerIds)
						for (const id of idsToImport) {
							const trigger = data.triggers[id]

							let controlId = CreateTriggerControlId(id)
							// If trigger already exists, generate a new id
							if (this.#controlsController.getControl(controlId)) controlId = CreateTriggerControlId(nanoid())

							const fixedControlObj = this.#fixupTriggerControl(trigger, instanceIdMap)
							this.#controlsController.importTrigger(controlId, fixedControlObj)
						}

						// Report the used remap to the ui, for future imports
						const instanceRemap2: ConnectionRemappings = {}
						for (const [id, obj] of Object.entries(instanceIdMap)) {
							instanceRemap2[id] = obj.id
						}

						return instanceRemap2
					})
				}),

			importFull: publicProcedure
				.input(z.object({ config: zodClientImportSelection, fullReset: z.boolean() }))
				.mutation(async ({ input: { config, fullReset }, ctx }) => {
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

						// Import connection collections if provided
						this.#instancesController.connectionCollections.replaceCollections(data.connectionCollections || [])

						// Always Import instances
						const preserveRemap: ConnectionRemappings =
							resetArg && !resetArg.connections ? this.#createDefaultConnectionRemap(data.instances) : {}
						const instanceIdMap = this.#importInstances(data.instances, preserveRemap)

						// import custom variables
						if (config.customVariables) {
							this.#variablesController.custom.replaceCollections(data.customVariablesCollections || [])
							this.#variablesController.custom.replaceDefinitions(data.custom_variables || {})
						}

						// Import expression variables
						if (config.expressionVariables) {
							this.#controlsController.replaceExpressionVariableCollections(data.expressionVariablesCollections || [])

							for (const [id, variableDefinition] of Object.entries(data.expressionVariables || {})) {
								const controlId = CreateExpressionVariableControlId(id)
								const fixedControlObj = this.#fixupExpressionVariableControl(variableDefinition, instanceIdMap)

								this.#controlsController.importExpressionVariable(controlId, fixedControlObj)
							}
						}

						// note data.pages is needed only to satisfy TypeScript, since config.buttons is false if pages is missing.
						if (data.pages && config.buttons) {
							// Import pages
							for (const [pageNumber0, pageInfo] of Object.entries(data.pages)) {
								if (!pageInfo) continue

								const pageNumber = Number(pageNumber0)
								if (isNaN(pageNumber)) {
									this.#logger.warn(`Invalid page number: ${pageNumber0}`)
									continue
								}

								// Ensure the page exists
								const insertPageCount = pageNumber - this.#pagesController.store.getPageCount()
								if (insertPageCount > 0) {
									this.#pagesController.insertPages(
										this.#pagesController.store.getPageCount() + 1,
										new Array(insertPageCount).fill('Page')
									)
								}

								this.#performPageImport(pageInfo, pageNumber, instanceIdMap)
							}
						}

						if (config.surfaces) {
							const surfaces = data.surfaces || ({} as Record<number, SurfaceConfig>)
							const surfaceGroups = data.surfaceGroups || ({} as Record<number, SurfaceGroupConfig>)
							const getPageId = (val: number) =>
								this.#pagesController.store.getPageId(val) ?? this.#pagesController.store.getFirstPageId()
							const fixPageId = (groupConfig: SurfaceGroupConfig) => {
								if (!groupConfig) return

								if ('last_page' in groupConfig) {
									groupConfig.last_page_id = getPageId(groupConfig.last_page!)
									delete groupConfig.last_page
								}
								if ('startup_page' in groupConfig) {
									groupConfig.startup_page_id = getPageId(groupConfig.startup_page!)
									delete groupConfig.startup_page
								}
							}

							// Convert external page refs, i.e. page numbers, to internal ids.
							for (const surface of Object.values(surfaces)) {
								fixPageId(surface.groupConfig)
							}
							for (const groupConfig of Object.values(surfaceGroups)) {
								fixPageId(groupConfig)
							}
							this.#surfacesController.importSurfaces(surfaceGroups, surfaces)
						}

						if (config.triggers) {
							// Import trigger collections if provided
							if (data.triggerCollections) {
								this.#controlsController.replaceTriggerCollections(data.triggerCollections)
							}

							for (const [id, trigger] of Object.entries(data.triggers || {})) {
								const controlId = CreateTriggerControlId(id)
								const fixedControlObj = this.#fixupTriggerControl(trigger, instanceIdMap)
								this.#controlsController.importTrigger(controlId, fixedControlObj)
							}
						}

						// trigger startup triggers to run
						setImmediate(() => {
							this.#controlsController.triggers.emit('startup')
						})
					})
				}),
		})
	}

	#performPageImport = (
		pageInfo: ExportPageContentv6,
		topage: number,
		instanceIdMap: InstanceAppliedRemappings
	): void => {
		{
			// Ensure the configured grid size is large enough for the import
			const requiredSize = pageInfo.gridSize || find_smallest_grid_for_page(pageInfo)
			const currentSize = this.#userConfigController.getKey('gridSize')
			const updatedSize: Partial<UserConfigGridSize> = {}
			if (currentSize.minColumn > requiredSize.minColumn) updatedSize.minColumn = Number(requiredSize.minColumn)
			if (currentSize.maxColumn < requiredSize.maxColumn) updatedSize.maxColumn = Number(requiredSize.maxColumn)
			if (currentSize.minRow > requiredSize.minRow) updatedSize.minRow = Number(requiredSize.minRow)
			if (currentSize.maxRow < requiredSize.maxRow) updatedSize.maxRow = Number(requiredSize.maxRow)

			if (Object.keys(updatedSize).length > 0) {
				this.#userConfigController.setKey('gridSize', {
					...currentSize,
					...updatedSize,
				})
			}
		}

		// Import the new page
		this.#pagesController.setPageName(topage, pageInfo.name)

		const connectionLabelRemap: Record<string, string> = {}
		const connectionIdRemap: Record<string, string> = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.oldLabel && info.label !== info.oldLabel) {
				connectionLabelRemap[info.oldLabel] = info.label
			}
			if (info.id && info.id !== oldId) {
				connectionIdRemap[oldId] = info.id
			}
		}
		const referencesUpdater = new VisitorReferencesUpdater(
			this.#internalModule,
			connectionLabelRemap,
			connectionIdRemap
		)

		// Import the controls
		for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
			for (const [column, control] of Object.entries(rowObj)) {
				if (control) {
					// Import the control
					const fixedControlObj = this.#fixupControl(cloneDeep(control), referencesUpdater, instanceIdMap)
					if (!fixedControlObj) continue

					const location: ControlLocation = {
						pageNumber: Number(topage),
						column: Number(column),
						row: Number(row),
					}
					this.#controlsController.importControl(location, fixedControlObj)
				}
			}
		}
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

	#createDefaultConnectionRemap(instances: ExportInstancesv6 | undefined): ConnectionRemappings {
		const remap: ConnectionRemappings = {}
		if (!instances) return remap

		for (const [oldId, obj] of Object.entries(instances)) {
			if (!obj || !obj.label) continue

			// See if there is an existing instance with the same label and type
			const existingId = this.#instancesController.getIdForLabel(obj.label)
			if (
				existingId &&
				this.#instancesController.getInstanceConfigOfType(existingId, ModuleInstanceType.Connection)?.instance_type ===
					obj.instance_type
			) {
				remap[oldId] = existingId
			} else {
				remap[oldId] = undefined // Create a new instance
			}
		}

		return remap
	}

	#importInstances(
		instances: ExportInstancesv6 | undefined,
		instanceRemapping: ConnectionRemappings
	): InstanceAppliedRemappings {
		const instanceIdMap: InstanceAppliedRemappings = {}

		if (instances) {
			const instanceEntries = Object.entries(instances).filter((ent) => !!ent[1])

			for (const [oldId, obj] of instanceEntries) {
				if (!obj || !obj.label) continue

				const remapId = instanceRemapping[oldId]
				const remapLabel = remapId ? this.#instancesController.getLabelForConnection(remapId) : undefined
				if (remapId === '_ignore') {
					// Ignore
					instanceIdMap[oldId] = { id: '_ignore', label: 'Ignore' }
				} else if (remapId && remapLabel) {
					// Reuse an existing instance
					instanceIdMap[oldId] = {
						id: remapId,
						label: remapLabel,
						lastUpgradeIndex: obj.lastUpgradeIndex,
						oldLabel: obj.label,
					}
				} else {
					// Create a new instance
					const [newId, newConfig] = this.#instancesController.addConnectionWithLabel(
						{ type: obj.instance_type },
						obj.label,
						{
							versionId: obj.moduleVersionId ?? null,
							updatePolicy: obj.updatePolicy,
							disabled: true,
							collectionId: obj.collectionId,
							sortOrder: obj.sortOrder ?? 0,
						}
					)
					if (newId && newConfig) {
						this.#instancesController.setConnectionLabelAndConfig(newId, {
							label: null,
							config: 'config' in obj ? obj.config : null,
							secrets: 'secrets' in obj ? obj.secrets : null,
							updatePolicy: null,
							upgradeIndex: obj.lastUpgradeIndex,
						})

						if (!('enabled' in obj) || obj.enabled !== false) {
							this.#instancesController.enableDisableConnection(newId, true)
						}

						instanceIdMap[oldId] = {
							id: newId,
							label: newConfig.label,
							lastUpgradeIndex: obj.lastUpgradeIndex,
							oldLabel: obj.label,
						}
					}
				}
			}
		}

		// Force the internal module mapping
		instanceIdMap['internal'] = { id: 'internal', label: 'internal' }
		instanceIdMap['bitfocus-companion'] = { id: 'internal', label: 'internal' }

		// Ensure any group references are valid
		this.#instancesController.connectionCollections.removeUnknownCollectionReferences()

		return instanceIdMap
	}

	#fixupTriggerControl(control: ExportTriggerContentv6, instanceIdMap: InstanceAppliedRemappings): TriggerModel {
		// Future: this does not feel durable

		const connectionLabelRemap: Record<string, string> = {}
		const connectionIdRemap: Record<string, string> = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.oldLabel && info.label !== info.oldLabel) {
				connectionLabelRemap[info.oldLabel] = info.label
			}
			if (info.id && info.id !== oldId) {
				connectionIdRemap[oldId] = info.id
			}
		}

		const result: TriggerModel = {
			type: 'trigger',
			options: cloneDeep(control.options),
			actions: [],
			condition: [],
			events: control.events,
			localVariables: [],
		}

		if (control.condition) {
			result.condition = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.condition))
		}

		if (control.actions) {
			result.actions = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.actions))
		}

		if (control.localVariables) {
			result.localVariables = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.localVariables))
		}

		new VisitorReferencesUpdater(this.#internalModule, connectionLabelRemap, connectionIdRemap)
			.visitEntities([], result.condition.concat(result.actions))
			.visitEvents(result.events || [])

		return result
	}

	#fixupExpressionVariableControl(
		control: ExpressionVariableModel,
		instanceIdMap: InstanceAppliedRemappings
	): ExpressionVariableModel {
		// Future: this does not feel durable

		const connectionLabelRemap: Record<string, string> = {}
		const connectionIdRemap: Record<string, string> = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.oldLabel && info.label !== info.oldLabel) {
				connectionLabelRemap[info.oldLabel] = info.label
			}
			if (info.id && info.id !== oldId) {
				connectionIdRemap[oldId] = info.id
			}
		}

		const result: ExpressionVariableModel = {
			type: 'expression-variable',
			options: cloneDeep(control.options),
			entity: null,
			localVariables: [],
		}

		if (control.entity) {
			result.entity = fixupEntitiesRecursive(instanceIdMap, [cloneDeep(control.entity)])[0]
		}

		if (control.localVariables) {
			result.localVariables = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.localVariables))
		}

		const visitor = new VisitorReferencesUpdater(
			this.#internalModule,
			connectionLabelRemap,
			connectionIdRemap
		).visitEntities([], result.localVariables)
		if (result.entity) visitor.visitEntities([], [result.entity])

		return result
	}

	#fixupControl(
		control: ExportControlv6,
		referencesUpdater: VisitorReferencesUpdater,
		instanceIdMap: InstanceAppliedRemappings
	): SomeButtonModel | null {
		// Future: this does not feel durable

		if (control.type === 'pagenum' || control.type === 'pageup' || control.type === 'pagedown') {
			return {
				type: control.type,
			}
		}

		const result: NormalButtonModel = {
			type: 'button',
			options: cloneDeep(control.options),
			style: cloneDeep(control.style),
			feedbacks: [],
			steps: {},
			localVariables: [],
		}

		if (control.feedbacks) {
			result.feedbacks = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.feedbacks))
		}

		if (control.localVariables) {
			result.localVariables = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.localVariables))
		}

		const allEntities: SomeEntityModel[] = [...result.feedbacks, ...result.localVariables]
		if (control.steps) {
			for (const [stepId, step] of Object.entries<any>(control.steps)) {
				const newStepSets: ActionSetsModel = {
					down: [],
					up: [],
					rotate_left: undefined,
					rotate_right: undefined,
				}
				result.steps[stepId] = {
					action_sets: newStepSets,
					options: cloneDeep(step.options),
				}

				for (const [setId, action_set] of Object.entries<any>(step.action_sets)) {
					const setIdSafe = validateActionSetId(setId as any)
					if (setIdSafe === undefined) {
						this.#logger.warn(`Invalid set id: ${setId}`)
						continue
					}

					const newActions = fixupEntitiesRecursive(instanceIdMap, cloneDeep(action_set))

					newStepSets[setIdSafe] = newActions
					allEntities.push(...newActions)
				}
			}
		}

		referencesUpdater.visitEntities([], allEntities).visitButtonDrawStyle(result.style)

		return result
	}
}

type InstanceAppliedRemappings = Record<
	string,
	{ id: string; label: string; lastUpgradeIndex?: number; oldLabel?: string }
>

function fixupEntitiesRecursive(
	instanceIdMap: InstanceAppliedRemappings,
	entities: SomeEntityModel[]
): SomeEntityModel[] {
	const newEntities: SomeEntityModel[] = []
	for (const entity of entities) {
		if (!entity) continue

		const instanceInfo = instanceIdMap[entity.connectionId]
		if (!instanceInfo) continue

		let newChildren: Record<string, SomeEntityModel[]> | undefined
		if (entity.connectionId === 'internal' && entity.children) {
			newChildren = {}
			for (const [group, childEntities] of Object.entries(entity.children)) {
				if (!childEntities) continue

				newChildren[group] = fixupEntitiesRecursive(instanceIdMap, childEntities)
			}
		}

		newEntities.push({
			...entity,
			connectionId: instanceInfo.id,
			upgradeIndex: instanceInfo.lastUpgradeIndex,
			children: newChildren,
		})
	}
	return newEntities
}
