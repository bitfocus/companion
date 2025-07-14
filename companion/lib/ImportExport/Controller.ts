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
import { CreateTriggerControlId, validateActionSetId } from '@companion-app/shared/ControlId.js'
import yaml from 'yaml'
import zlib from 'node:zlib'
import { ReferencesVisitors } from '../Resources/Visitors/ReferencesVisitors.js'
import LogController from '../Log/Controller.js'
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
import { zodLocation } from '../Graphics/Preview.js'
import z from 'zod'
import { EventEmitter } from 'node:events'
import { BackupController } from './Backups.js'
import type { DataDatabase } from '../Data/Database.js'

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
				for (const inst of Object.values(object.instances)) {
					if (inst) {
						inst.lastUpgradeIndex = inst.lastUpgradeIndex ?? -1
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
				surfaces: 'surfaces' in object,
				triggers: 'triggers' in object,
			}

			for (const [instanceId, instance] of Object.entries(object.instances || {})) {
				if (!instance || instanceId === 'internal' || instanceId === 'bitfocus-companion') continue

				clientObject.instances[instanceId] = {
					instance_type: instance.instance_type,
					moduleVersionId: instance.moduleVersionId ?? null,
					label: instance.label,
					sortOrder: instance.sortOrder,
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
							const currentPageCount = this.#pagesController.getPageCount()
							topage = currentPageCount + 1
							this.#pagesController.insertPages(topage, ['Importing Page'])
						} else {
							const oldPageInfo = this.#pagesController.getPageInfo(topage, false)
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

			importFull: publicProcedure.input(zodClientImportSelection).mutation(async ({ input, ctx }) => {
				return this.#checkOrRunImportTask('import', async () => {
					const data = ctx.pendingImport?.object
					if (!data) throw new Error('No in-progress import object')

					if (data.type !== 'full') throw new Error('Invalid import object')

					// Destroy old stuff
					await this.#reset(undefined, !input || input.buttons)

					// import custom variables
					if (!input || input.customVariables) {
						if (data.customVariablesCollections) {
							this.#variablesController.custom.replaceCollections(data.customVariablesCollections)
						}

						this.#variablesController.custom.replaceDefinitions(data.custom_variables || {})
					}

					// Import connection collections if provided
					if (data.connectionCollections) {
						this.#instancesController.collections.replaceCollections(data.connectionCollections)
					}

					// Always Import instances
					const instanceIdMap = this.#importInstances(data.instances, {})

					if (data.pages && (!input || input.buttons)) {
						// Import pages
						for (const [pageNumber0, pageInfo] of Object.entries(data.pages)) {
							if (!pageInfo) continue

							const pageNumber = Number(pageNumber0)
							if (isNaN(pageNumber)) {
								this.#logger.warn(`Invalid page number: ${pageNumber0}`)
								continue
							}

							// Ensure the page exists
							const insertPageCount = pageNumber - this.#pagesController.getPageCount()
							if (insertPageCount > 0) {
								this.#pagesController.insertPages(
									this.#pagesController.getPageCount() + 1,
									new Array(insertPageCount).fill('Page')
								)
							}

							this.#performPageImport(pageInfo, pageNumber, instanceIdMap)
						}
					}

					if (!input || input.surfaces) {
						this.#surfacesController.importSurfaces(data.surfaceGroups || {}, data.surfaces || {})
					}

					if (!input || input.triggers) {
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

		// Import the controls
		for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
			for (const [column, control] of Object.entries(rowObj)) {
				if (control) {
					// Import the control
					const fixedControlObj = this.#fixupControl(cloneDeep(control), instanceIdMap)

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

	async #reset(config: ClientResetSelection | undefined, skipNavButtons = false): Promise<'ok'> {
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
			const pageCount = this.#pagesController.getPageCount()
			for (let pageNumber = pageCount; pageNumber >= 2; pageNumber--) {
				this.#pagesController.deletePage(pageNumber) // Note: controls were already deleted above
			}

			// reset the size
			this.#userConfigController.resetKey('gridSize')
		}

		if (!config || config.connections) {
			await this.#instancesController.deleteAllInstances(true)
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
			this.#controlsController.discardTriggerCollections()
		}

		if (!config || config.customVariables) {
			this.#variablesController.custom.reset()
		}

		if (!config || config.userconfig) {
			this.#userConfigController.reset()
		}

		return 'ok'
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
				const remapLabel = remapId ? this.#instancesController.getLabelForInstance(remapId) : undefined
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
					const [newId, newConfig] = this.#instancesController.addInstanceWithLabel(
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
						this.#instancesController.setInstanceLabelAndConfig(newId, {
							label: null,
							config: 'config' in obj ? obj.config : null,
							secrets: 'secrets' in obj ? obj.secrets : null,
							updatePolicy: null,
							upgradeIndex: obj.lastUpgradeIndex,
						})

						if (!('enabled' in obj) || obj.enabled !== false) {
							this.#instancesController.enableDisableInstance(newId, true)
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
		this.#instancesController.collections.removeUnknownCollectionReferences()

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
		}

		if (control.condition) {
			result.condition = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.condition))
		}

		if (control.actions) {
			result.actions = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.actions))
		}

		ReferencesVisitors.fixupControlReferences(
			this.#internalModule,
			{
				connectionLabels: connectionLabelRemap,
				connectionIds: connectionIdRemap,
			},
			undefined,
			result.condition.concat(result.actions),
			[],
			result.events || [],
			false
		)

		return result
	}

	#fixupControl(control: ExportControlv6, instanceIdMap: InstanceAppliedRemappings): SomeButtonModel {
		// Future: this does not feel durable

		if (control.type === 'pagenum' || control.type === 'pageup' || control.type === 'pagedown') {
			return {
				type: control.type,
			}
		}

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

		const result: NormalButtonModel = {
			type: 'button',
			options: cloneDeep(control.options),
			style: cloneDeep(control.style),
			feedbacks: [],
			steps: {},
		}

		if (control.feedbacks) {
			result.feedbacks = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.feedbacks))
		}

		const allEntities: SomeEntityModel[] = [...result.feedbacks]
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

		ReferencesVisitors.fixupControlReferences(
			this.#internalModule,
			{
				connectionLabels: connectionLabelRemap,
				connectionIds: connectionIdRemap,
			},
			result.style,
			allEntities,
			[],
			[],
			false
		)

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
