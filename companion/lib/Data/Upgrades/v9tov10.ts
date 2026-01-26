import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import { cloneDeep } from 'lodash-es'
import type {
	ExportFullv6,
	ExportInstancesv6,
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
import type { UserConfigGridSize, BackupRulesConfig } from '@companion-app/shared/Model/UserConfigModel.js'

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

interface OldUserConfigModel {
	setup_wizard: number

	page_direction_flipped: boolean
	page_plusminus: boolean
	remove_topbar: boolean

	xkeys_enable: boolean
	elgato_plugin_enable: boolean // Also disables local streamdeck
	usb_hotplug: boolean
	loupedeck_enable: boolean
	mirabox_streamdock_enable: boolean
	contour_shuttle_enable: boolean
	vec_footpedal_enable: boolean
	blackmagic_controller_enable: boolean
	mystrix_enable: boolean
	logitech_mx_console_enable: boolean

	pin_enable: boolean
	link_lockouts: boolean
	pin: string
	pin_timeout: number

	http_api_enabled: boolean
	http_legacy_api_enabled: boolean

	tcp_enabled: boolean
	tcp_listen_port: number
	tcp_legacy_api_enabled: boolean

	udp_enabled: boolean
	udp_listen_port: number
	udp_legacy_api_enabled: boolean

	osc_enabled: boolean
	osc_listen_port: number
	osc_legacy_api_enabled: boolean

	rosstalk_enabled: boolean

	emberplus_enabled: boolean

	videohub_panel_enabled: boolean

	artnet_enabled: boolean
	artnet_universe: number
	artnet_channel: number

	https_enabled: boolean
	https_port: number
	https_cert_type: string
	https_self_cn: string
	https_self_expiry: number
	https_self_cert: string
	https_self_cert_created: string
	https_self_cert_cn: string
	https_self_cert_expiry: string
	https_self_cert_private: string
	https_self_cert_public: string
	https_ext_private_key: string
	https_ext_certificate: string
	https_ext_chain: string

	admin_lockout: boolean
	admin_timeout: number
	admin_password: string

	gridSize: UserConfigGridSize
	gridSizeInlineGrow: boolean
	gridSizePromptGrow: boolean

	installName: string
	default_export_filename: string

	backups: BackupRulesConfig[]
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

	// Create surface integrations based on old userconfig settings
	const userconfig: Partial<OldUserConfigModel> = db.defaultTableView.getOrDefault('userconfig', {})

	const createInstanceIfNeeded = (
		oldKey: keyof OldUserConfigModel,
		moduleId: string,
		isBuiltin: boolean,
		invertState = false,
		preserveConfig = false
	) => {
		// Only create instance if the setting is enabled
		const isEnabled = invertState ? !userconfig[oldKey] : userconfig[oldKey]
		if (!preserveConfig) delete userconfig[oldKey]
		if (!isEnabled) return

		// Don't create duplicate instances
		if (allSurfaceInstanceModuleIds.has(moduleId)) return

		const newInstanceId = nanoid()
		allSurfaceInstanceModuleIds.set(moduleId, newInstanceId)

		// Create the instance
		instances.set(newInstanceId, {
			moduleInstanceType: ModuleInstanceType.Surface,
			moduleId: moduleId,
			moduleVersionId: isBuiltin ? 'builtin' : null,
			label: moduleId,
			config: {},
			secrets: undefined,
			isFirstInit: true,
			lastUpgradeIndex: 0,
			enabled: true,
			sortOrder: 0,
			updatePolicy: InstanceVersionUpdatePolicy.Stable,
		} satisfies InstanceConfig)
	}

	// Note: this will remove the old config fields
	createInstanceIfNeeded('elgato_plugin_enable', 'elgato-stream-deck', true, true, true)
	createInstanceIfNeeded('xkeys_enable', 'xkeys', true)
	createInstanceIfNeeded('loupedeck_enable', 'loupedeck', false)
	createInstanceIfNeeded('mirabox_streamdock_enable', 'mirabox-stream-dock', false)
	createInstanceIfNeeded('contour_shuttle_enable', 'contour-shuttle', false)
	createInstanceIfNeeded('vec_footpedal_enable', 'vec-footpedal', false)
	createInstanceIfNeeded('blackmagic_controller_enable', 'blackmagic-controller', false)
	createInstanceIfNeeded('mystrix_enable', '203-systems-mystrix', false)
	createInstanceIfNeeded('logitech_mx_console_enable', 'logitech-mx-creative-console', false)
	createInstanceIfNeeded('videohub_panel_enabled', 'blackmagic-videohub-panel', false)

	db.defaultTableView.set('userconfig', userconfig)

	// Convert any remote surfaces to new format
	const remoteSurfaces = db.getTableView('surfaces_remote')
	const anyRemoteSurfacesAreLegacyElgato = Object.values(remoteSurfaces.all()).some((surface) => {
		return (surface as LegacyOutboundSurfaceInfo).type === 'elgato'
	})
	if (anyRemoteSurfacesAreLegacyElgato) {
		let elgatoSurfaceInstanceId = allSurfaceInstanceModuleIds.get('elgato-stream-deck')
		if (!elgatoSurfaceInstanceId) {
			// Create new elgato surface integration

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
					moduleId: 'elgato-stream-deck',
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

function fixupImportInstances(obj: ExportInstancesv6 | undefined): void {
	if (!obj) return

	for (const config of Object.values(obj)) {
		config.moduleId = config.moduleId || config.instance_type
		delete config.instance_type
	}
}

function convertImportToV10(obj: SomeExportv6): SomeExportv6 {
	if (obj.type == 'full') {
		const newObj: ExportFullv6 = {
			...cloneDeep(obj),
			version: 10,
		}

		fixupImportInstances(newObj.instances)

		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv6 = {
			...cloneDeep(obj),
			version: 10,
		}

		fixupImportInstances(newObj.instances)

		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv6 = {
			...cloneDeep(obj),
			version: 10,
		}

		fixupImportInstances(newObj.instances)

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
