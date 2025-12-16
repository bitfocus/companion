import type {
	ExportFullv6,
	ExportInstancesv6,
	ExportPageContentv6,
	ExportTriggerContentv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { ControlsController } from '../Controls/Controller.js'
import { CreateExpressionVariableControlId, CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import type {
	ClientImportOrResetSelection,
	ConnectionRemappings,
	ImportOrResetType,
} from '@companion-app/shared/Model/ImportExport.js'
import {
	fixupButtonControl,
	fixupLayeredButtonControl,
	fixupExpressionVariableControl,
	fixupTriggerControl,
	type InstanceAppliedRemappings,
} from './ImportFixup.js'
import type { InternalController } from '../Internal/Controller.js'
import { nanoid } from 'nanoid'
import type { InstanceController } from '../Instance/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { VisitorReferencesUpdater } from '../Resources/Visitors/ReferencesUpdater.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import { find_smallest_grid_for_page } from './Util.js'
import LogController from '../Log/Controller.js'
import type { SurfaceConfig, SurfaceGroupConfig } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfaceController } from '../Surface/Controller.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { VariablesController } from '../Variables/Controller.js'
import { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'

export class ImportController {
	readonly #logger = LogController.createLogger('ImportExport/Import')

	readonly #controlsController: ControlsController
	readonly #internalModule: InternalController
	readonly #instancesController: InstanceController
	readonly #graphicsController: GraphicsController
	readonly #pagesController: PageController
	readonly #userConfigController: DataUserConfig
	readonly #surfacesController: SurfaceController
	readonly #variablesController: VariablesController

	constructor(
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
		this.#internalModule = internalModule
		this.#instancesController = instance
		this.#graphicsController = graphics
		this.#pagesController = page
		this.#userConfigController = userconfig
		this.#surfacesController = surfaces
		this.#variablesController = variablesController
	}

	importSinglePage(
		instances: ExportInstancesv6 | undefined,
		connectionIdRemapping: Record<string, string | undefined>,
		pageInfo: ExportPageContentv6,
		topage: number
	): ConnectionRemappings {
		// Setup the new instances
		const instanceIdMap = this.#importInstances(instances, connectionIdRemapping)

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
	}

	importTriggers(
		instances: ExportInstancesv6 | undefined,
		connectionIdRemapping: Record<string, string | undefined>,
		triggers: Record<string, ExportTriggerContentv6>,
		selectedTriggerIds: string[],
		replaceExisting: boolean
	): ConnectionRemappings {
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
		const instanceIdMap = this.#importInstances(instances, connectionIdRemapping)

		const idsToImport = new Set(selectedTriggerIds)
		for (const id of idsToImport) {
			const trigger = triggers[id]

			let controlId = CreateTriggerControlId(id)
			// If trigger already exists, generate a new id
			if (this.#controlsController.getControl(controlId)) controlId = CreateTriggerControlId(nanoid())

			const fixedControlObj = fixupTriggerControl(this.#internalModule, trigger, instanceIdMap)
			this.#controlsController.importTrigger(controlId, fixedControlObj)
		}

		// Report the used remap to the ui, for future imports
		const instanceRemap2: ConnectionRemappings = {}
		for (const [id, obj] of Object.entries(instanceIdMap)) {
			instanceRemap2[id] = obj.id
		}

		return instanceRemap2
	}

	importFull(data: ExportFullv6, config: ClientImportOrResetSelection): void {
		const isImporting = (value: ImportOrResetType): boolean => value === 'reset-and-import'

		const mergeConnections = config.connections === 'unchanged'

		// Always Import instances
		// Import connection collections if provided
		if (data.connectionCollections && data.connectionCollections.length > 0) {
			this.#instancesController.connectionCollections.replaceCollections(
				data.connectionCollections || [],
				mergeConnections
			)
		}

		// Always Import instances
		const preserveRemap: ConnectionRemappings = mergeConnections
			? this.#createDefaultConnectionRemap(data.instances)
			: {}
		const instanceIdMap = this.#importInstances(data.instances, preserveRemap)

		// import custom variables
		if (isImporting(config.customVariables)) {
			this.#variablesController.custom.replaceCollections(data.customVariablesCollections || [])
			this.#variablesController.custom.replaceDefinitions(data.custom_variables || {})
		}

		// Import expression variables
		if (isImporting(config.expressionVariables)) {
			this.#controlsController.replaceExpressionVariableCollections(data.expressionVariablesCollections || [])

			for (const [id, variableDefinition] of Object.entries(data.expressionVariables || {})) {
				const controlId = CreateExpressionVariableControlId(id)
				const fixedControlObj = fixupExpressionVariableControl(this.#internalModule, variableDefinition, instanceIdMap)

				this.#controlsController.importExpressionVariable(controlId, fixedControlObj)
			}
		}

		// note data.pages is needed only to satisfy TypeScript, since config.buttons is false if pages is missing.
		if (isImporting(config.buttons)) {
			// Import pages
			for (const [pageNumber0, pageInfo] of Object.entries(data.pages ?? {})) {
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

		if (isImporting(config.surfaces.known)) {
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
				if (groupConfig.allowed_pages !== undefined) {
					const page_ids = groupConfig.allowed_pages.map((nr) => getPageId(nr))
					groupConfig.allowed_page_ids = page_ids
					delete groupConfig.allowed_pages
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

		const surfaceInstancesMap = new Map<string, string>()

		if (isImporting(config.surfaces.instances)) {
			this.#instancesController.surfaceInstanceCollections.replaceCollections(data.surfaceInstanceCollections || [])

			for (const [instanceId, instanceConfig] of Object.entries(data.surfaceInstances || {})) {
				// Create a new instance
				const [newId, newConfig] = this.#instancesController.addSurfaceInstanceWithLabel(
					instanceConfig.moduleId,
					instanceConfig.label,
					{
						versionId: instanceConfig.moduleVersionId ?? null,
						updatePolicy: instanceConfig.updatePolicy,
						disabled: true,
						collectionId: instanceConfig.collectionId,
						sortOrder: instanceConfig.sortOrder ?? 0,
					}
				)

				if (newId && newConfig) {
					surfaceInstancesMap.set(instanceId, newId)

					this.#instancesController.setSurfaceInstanceLabelAndConfig(newId, {
						label: null,
						enabled: instanceConfig.enabled !== false,
						config: 'config' in instanceConfig ? instanceConfig.config : null,
						// secrets: 'secrets' in instanceConfig ? instanceConfig.secrets : null,
						updatePolicy: null,
						// upgradeIndex: instanceConfig.lastUpgradeIndex,
					})
				}
			}
		}

		if (isImporting(config.surfaces.remote)) {
			// Compile a map of fallback instance ids by module type
			const fallbackSurfaceInstances = new Map<string, string>()
			const surfaceInstances = this.#instancesController.getSurfaceInstanceClientJson()
			for (const instance of Object.values(surfaceInstances)) {
				if (!fallbackSurfaceInstances.has(instance.moduleId))
					fallbackSurfaceInstances.set(instance.moduleId, instance.id)
			}

			for (const remoteInfo of Object.values(data.surfacesRemote || {})) {
				let instanceId = remoteInfo.instanceId
				if (!surfaceInstances[instanceId]) {
					// Try and remap the instance id, or fallback to using the module type
					instanceId =
						surfaceInstancesMap.get(instanceId) || fallbackSurfaceInstances.get(remoteInfo.moduleId) || instanceId
				}

				// Future: validation
				this.#surfacesController.outbound.addOutboundConnection({
					...remoteInfo,
					// Translate the instanceId
					instanceId: instanceId,
				})
			}
		}

		if (isImporting(config.triggers)) {
			// Import trigger collections if provided
			if (data.triggerCollections) {
				this.#controlsController.replaceTriggerCollections(data.triggerCollections)
			}

			for (const [id, trigger] of Object.entries(data.triggers || {})) {
				const controlId = CreateTriggerControlId(id)
				const fixedControlObj = fixupTriggerControl(this.#internalModule, trigger, instanceIdMap)
				this.#controlsController.importTrigger(controlId, fixedControlObj)
			}
		}

		// Import image library data if present
		if (isImporting(config.imageLibrary)) {
			this.#graphicsController.imageLibrary.importImageLibrary(
				data.imageLibraryCollections || [],
				data.imageLibrary || []
			)
		}
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
					let fixedControlObj: SomeButtonModel
					if (control.type === 'button') {
						fixedControlObj = fixupButtonControl(this.#logger, control, referencesUpdater, instanceIdMap)
					} else if (control.type === 'button-layered') {
						fixedControlObj = fixupLayeredButtonControl(this.#logger, control, referencesUpdater, instanceIdMap)
					} else {
						this.#logger.warn(`Unknown control type: ${control.type}`)
						continue
					}

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
						{ type: obj.moduleId },
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
							enabled: obj.enabled !== false,
							config: 'config' in obj ? obj.config : null,
							secrets: 'secrets' in obj ? obj.secrets : null,
							updatePolicy: null,
							upgradeIndex: obj.lastUpgradeIndex,
						})

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

	#createDefaultConnectionRemap(instances: ExportInstancesv6 | undefined): ConnectionRemappings {
		const remap: ConnectionRemappings = {}
		if (!instances) return remap

		for (const [oldId, obj] of Object.entries(instances)) {
			if (!obj || !obj.label) continue

			// See if there is an existing instance with the same label and type
			const existingId = this.#instancesController.getIdForLabel(ModuleInstanceType.Connection, obj.label)
			if (
				existingId &&
				this.#instancesController.getInstanceConfigOfType(existingId, ModuleInstanceType.Connection)?.moduleId ===
					obj.moduleId
			) {
				remap[oldId] = existingId
			} else {
				remap[oldId] = undefined // Create a new instance
			}
		}

		return remap
	}
}
