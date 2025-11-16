import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import { cloneDeep } from 'lodash-es'
import type {
	ExportFullv6,
	ExportPageModelv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import {
	type InstanceConfig,
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
} from '@companion-app/shared/Model/Instance.js'
import { nanoid } from 'nanoid'

interface LegacyOutboundSurfaceInfo {
	id: string
	displayName: string
	type: 'elgato'
	enabled: boolean
	address: string
	port: number
	collectionId: string | null
	sortOrder: number
}

/**
 * do the database upgrades to convert from the v9 to the v10 format
 */
function convertDatabaseToV10(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	// Rename the connections table to instances
	db.renameTable('connections', 'instances')

	const instances = db.getTableView('instances')

	// Find all the known surface module ids
	const allSurfaceInstanceModuleIds = new Map<string, string>()
	for (const [instanceId, instance] of Object.entries(instances.all())) {
		if (instance.moduleInstanceType === ModuleInstanceType.Surface) {
			const moduleId = instance.moduleId || instance.instance_type
			allSurfaceInstanceModuleIds.set(moduleId, instanceId)
		}
	}

	// update all instances to use moduleId instead of instance_type
	const allInstanceModuleIds = new Set<string>()
	for (const [instanceId, instance] of Object.entries(instances.all())) {
		const moduleId = instance.moduleId || instance.instance_type
		allInstanceModuleIds.add(moduleId)

		// Rename instance_type to moduleId
		instances.set(instanceId, {
			...instance,
			moduleInstanceType: instance.moduleInstanceType || ModuleInstanceType.Connection,
			moduleId: moduleId,
			instance_type: undefined,
			updatePolicy: instance.updatePolicy || InstanceVersionUpdatePolicy.Stable,
		})
	}

	const remoteSurfaces = db.getTableView('surfaces_remote')
	const anyRemoteSurfacesAreLegacyElgato = Object.values(remoteSurfaces.all()).some((surface) => {
		return (surface as LegacyOutboundSurfaceInfo).type === 'elgato'
	})

	// TODO - auto-create streamdeck instances for surfaces that need them

	// Convert any remote surfaces to new format
	if (anyRemoteSurfacesAreLegacyElgato) {
		let elgatoSurfaceInstanceId = allSurfaceInstanceModuleIds.get('elgato-stream-deck')
		if (!elgatoSurfaceInstanceId) {
			// Create new elgato surface instance

			// TODO - setup config to disable usb?

			// Create the instance
			elgatoSurfaceInstanceId = nanoid()
			instances.set(elgatoSurfaceInstanceId, {
				moduleInstanceType: ModuleInstanceType.Surface,
				moduleId: 'elgato-stream-deck',
				moduleVersionId: 'builtin',
				label: 'elgato-stream-deck',
				config: {},
				secrets: undefined,
				isFirstInit: true,
				lastUpgradeIndex: 0,
				enabled: true,
				sortOrder: 0,
				updatePolicy: InstanceVersionUpdatePolicy.Stable,
			} satisfies InstanceConfig)
		}

		for (const [surfaceId, surface] of Object.entries(remoteSurfaces.all())) {
			if ((surface as LegacyOutboundSurfaceInfo).type === 'elgato') {
				const legacySurface = surface as LegacyOutboundSurfaceInfo

				// Convert to new format
				const newSurface: OutboundSurfaceInfo = {
					id: legacySurface.id,
					displayName: legacySurface.displayName,
					type: 'plugin',
					enabled: legacySurface.enabled ?? true,
					instanceId: elgatoSurfaceInstanceId,
					config: {
						address: legacySurface.address,
						port: legacySurface.port || 5343,
					},
					collectionId: legacySurface.collectionId || null,
					sortOrder: legacySurface.sortOrder || 0,
				}

				remoteSurfaces.set(surfaceId, newSurface)
			}
		}
	}
}

function convertImportToV10(obj: SomeExportv6): SomeExportv6 {
	if (obj.type == 'full') {
		const newObj: ExportFullv6 = {
			...cloneDeep(obj),
			version: 10,
		}
		// if (newObj.pages) {
		// 	for (const page of Object.values(newObj.pages)) {
		// 		convertPageControls(page)
		// 	}
		// }
		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv6 = {
			...cloneDeep(obj),
			version: 10,
		}
		// convertPageControls(newObj.page)
		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv6 = {
			...cloneDeep(obj),
			version: 10,
		}
		return newObj
	} else {
		// No change
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV10,
	upgradeImport: convertImportToV10,
}
