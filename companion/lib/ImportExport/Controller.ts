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
import { compareExportedInstances } from '@companion-app/shared/Import.js'
import { ReferencesVisitors } from '../Resources/Visitors/ReferencesVisitors.js'
import LogController from '../Log/Controller.js'
import { nanoid } from 'nanoid'
import type express from 'express'
import type {
	ExportControlv6,
	ExportFullv6,
	ExportInstancesv6,
	ExportPageContentv6,
	ExportPageModelv6,
	ExportTriggerContentv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { AppInfo } from '../Registry.js'
import type {
	ClientImportObject,
	ClientPageInfo,
	ClientResetSelection,
	ConnectionRemappings,
} from '@companion-app/shared/Model/ImportExport.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
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

	readonly #io: UIHandler
	readonly #controlsController: ControlsController
	readonly #graphicsController: GraphicsController
	readonly #instancesController: InstanceController
	readonly #internalModule: InternalController
	readonly #pagesController: PageController
	readonly #surfacesController: SurfaceController
	readonly #userConfigController: DataUserConfig
	readonly #variablesController: VariablesController

	readonly #exportController: ExportController

	readonly #multipartUploader = new MultipartUploader((sessionId) => {
		this.#logger.info(`Config import session "${sessionId}" timed out`)
		// this.#io.emitToAll('loadsave:prepare-import:progress', sessionId, null)
	})

	/**
	 * If there is a current import task that clients should be aware of, this will be set
	 */
	#currentImportTask: 'reset' | 'import' | null = null

	constructor(
		appInfo: AppInfo,
		apiRouter: express.Router,
		io: UIHandler,
		controls: ControlsController,
		graphics: GraphicsController,
		instance: InstanceController,
		internalModule: InternalController,
		page: PageController,
		surfaces: SurfaceController,
		userconfig: DataUserConfig,
		variablesController: VariablesController
	) {
		this.#io = io
		this.#controlsController = controls
		this.#graphicsController = graphics
		this.#instancesController = instance
		this.#internalModule = internalModule
		this.#pagesController = page
		this.#surfacesController = surfaces
		this.#userConfigController = userconfig
		this.#variablesController = variablesController

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
	}

	async #checkOrRunImportTask<T>(newTaskType: 'reset' | 'import', executeFn: () => Promise<T>): Promise<T> {
		if (this.#currentImportTask) throw new Error('Another operation is in progress')

		this.#currentImportTask = newTaskType
		this.#io.emitToAll('load-save:task', this.#currentImportTask)

		try {
			return await executeFn()
		} finally {
			this.#currentImportTask = null
			this.#io.emitToAll('load-save:task', this.#currentImportTask)
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.#exportController.clientConnect(client)

		if (this.#currentImportTask) {
			// Inform about in progress task
			client.emit('load-save:task', this.#currentImportTask)
		}

		let clientPendingImport: ClientPendingImport | null = null

		client.onPromise('loadsave:abort', () => {
			if (clientPendingImport) {
				// TODO - stop timer
				clientPendingImport = null
			}

			return true
		})

		client.onPromise('loadsave:prepare-import:start', async (name, size) => {
			this.#logger.info(`Starting upload of import file ${name} (${size} bytes)`)

			if (size > MAX_IMPORT_FILE_SIZE) throw new Error('Import too large to upload')

			const sessionId = this.#multipartUploader.initSession(name, size)
			if (sessionId === null) return null

			this.#io.emitToAll('loadsave:prepare-import:progress', sessionId, 0)

			return sessionId
		})
		client.onPromise('loadsave:prepare-import:chunk', async (sessionId, offset, data) => {
			this.#logger.silly(`Upload import file chunk ${sessionId} (@${offset} = ${data.length} bytes)`)

			const progress = this.#multipartUploader.addChunk(sessionId, offset, data)
			if (progress === null) return false

			this.#io.emitToAll('loadsave:prepare-import:progress', sessionId, progress / 2)

			return true
		})
		client.onPromise('loadsave:prepare-import:cancel', async (sessionId) => {
			this.#logger.silly(`Canel import file upload ${sessionId}`)

			this.#multipartUploader.cancelSession(sessionId)
		})
		client.onPromise('loadsave:prepare-import:complete', async (sessionId, checksum) => {
			this.#logger.silly(`Attempt import file complete ${sessionId}`)

			const dataBytes = this.#multipartUploader.completeSession(sessionId, checksum)
			if (dataBytes === null) return ['File is corrupted or unknown format']

			this.#logger.info(`Importing config ${sessionId} (${dataBytes.length} bytes)`)

			this.#io.emitToAll('loadsave:prepare-import:progress', sessionId, 0.5)

			let dataStr: string
			try {
				dataStr = await new Promise((resolve, reject) => {
					zlib.gunzip(dataBytes, (err, data) => {
						if (err) reject(err)
						else resolve(data?.toString() || dataStr)
					})
				})
			} catch (e) {
				// Ignore, it is probably not compressed
				dataStr = dataBytes.toString()
			}

			let rawObject
			try {
				// YAML parser will handle JSON too
				rawObject = yaml.parse(dataStr)
			} catch (e) {
				return ['File is corrupted or unknown format']
			}

			if (rawObject.version > FILE_VERSION) {
				return ['File was saved with a newer unsupported version of Companion']
			}

			if (rawObject.type !== 'full' && rawObject.type !== 'page' && rawObject.type !== 'trigger_list') {
				return ['Unknown import type']
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
					triggers: object.triggers,
					instances: object.instances,
				} satisfies ExportFullv6
			}

			// Store the object on the client
			clientPendingImport = {
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
		})

		client.onPromise('loadsave:control-preview', async (location) => {
			const importObject = clientPendingImport?.object
			if (!importObject) return null

			let importPage
			if (importObject.type === 'page') {
				importPage = importObject.page
			} else if (importObject.type === 'full') {
				importPage = importObject.pages?.[location.pageNumber]
			}
			if (!importPage) return null

			const controlObj = importPage.controls?.[location.row]?.[location.column]
			if (!controlObj) return null

			const res = await this.#graphicsController.drawPreview({
				...controlObj.style,
				style: controlObj.type,
			})
			return !!res?.style ? (res?.asDataUrl ?? null) : null
		})

		client.onPromise('loadsave:reset', (config) => {
			if (!config) throw new Error('Missing reset config')

			return this.#checkOrRunImportTask('reset', async () => {
				return this.#reset(config)
			})
		})

		client.onPromise('loadsave:import-full', async (config) => {
			return this.#checkOrRunImportTask('import', async () => {
				const data = clientPendingImport?.object
				if (!data) throw new Error('No in-progress import object')

				if (data.type !== 'full') throw new Error('Invalid import object')

				// Destroy old stuff
				await this.#reset(undefined, !config || config.buttons)

				// import custom variables
				if (!config || config.customVariables) {
					this.#variablesController.custom.replaceDefinitions(data.custom_variables || {})
				}

				// Always Import instances
				const instanceIdMap = this.#importInstances(data.instances, {})

				if (data.pages && (!config || config.buttons)) {
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

						doPageImport(pageInfo, pageNumber, instanceIdMap)
					}
				}

				if (!config || config.surfaces) {
					this.#surfacesController.importSurfaces(data.surfaceGroups || {}, data.surfaces || {})
				}

				if (!config || config.triggers) {
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
		})

		const doPageImport = (
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

		client.onPromise('loadsave:import-page', async (topage, frompage, instanceRemapping) => {
			return this.#checkOrRunImportTask('import', async () => {
				const data = clientPendingImport?.object
				if (!data) throw new Error('No in-progress import object')

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
				const instanceIdMap = this.#importInstances(data.instances, instanceRemapping)

				// Cleanup the old page
				const discardedControlIds = this.#pagesController.resetPage(topage)
				for (const controlId of discardedControlIds) {
					this.#controlsController.deleteControl(controlId)
				}
				this.#graphicsController.clearAllForPage(topage)

				doPageImport(pageInfo, topage, instanceIdMap)

				// Report the used remap to the ui, for future imports
				const instanceRemap2: ConnectionRemappings = {}
				for (const [id, obj] of Object.entries(instanceIdMap)) {
					instanceRemap2[id] = obj.id
				}

				return instanceRemap2
			})
		})

		client.onPromise('loadsave:import-triggers', async (idsToImport0, instanceRemapping, replaceExisting) => {
			return this.#checkOrRunImportTask('import', async () => {
				const data = clientPendingImport?.object
				if (!data) throw new Error('No in-progress import object')

				if (data.type === 'page' || !data.triggers) throw new Error('No triggers in import')

				// Remove existing triggers
				if (replaceExisting) {
					const controls = this.#controlsController.getAllControls()
					for (const [controlId, control] of controls.entries()) {
						if (control.type === 'trigger') {
							this.#controlsController.deleteControl(controlId)
						}
					}
				}

				// Setup the new instances
				const instanceIdMap = this.#importInstances(data.instances, instanceRemapping)

				const idsToImport = new Set(idsToImport0)
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
		})
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
			const instanceEntries = Object.entries(instances)
				.filter((ent) => !!ent[1])
				.sort(compareExportedInstances)

			for (const [oldId, obj] of instanceEntries) {
				if (!obj) continue

				const remapId = instanceRemapping[oldId]
				const remapConfig = remapId ? this.#instancesController.getInstanceConfig(remapId) : undefined
				if (remapId === '_ignore') {
					// Ignore
					instanceIdMap[oldId] = { id: '_ignore', label: 'Ignore' }
				} else if (remapId && remapConfig?.label) {
					// Reuse an existing instance
					instanceIdMap[oldId] = {
						id: remapId,
						label: remapConfig.label,
						lastUpgradeIndex: obj.lastUpgradeIndex,
						oldLabel: obj.label,
					}
				} else {
					// Create a new instance
					const [newId, newConfig] = this.#instancesController.addInstanceWithLabel(
						{ type: obj.instance_type },
						obj.label,
						obj.moduleVersionId ?? null,
						obj.updatePolicy,
						true
					)
					if (newId && newConfig) {
						this.#instancesController.setInstanceLabelAndConfig(newId, null, 'config' in obj ? obj.config : null, null)

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

					const newActions = fixupEntitiesRecursive(instanceIdMap, cloneDeep(action_set) as any)

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

type ClientPendingImport = {
	object: ExportFullv6 | ExportPageModelv6
	timeout: null
}

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
