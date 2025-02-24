import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { UserConfigModel } from './Model/UserConfigModel.js'
import type { ClientLogLine } from './Model/LogLine.js'
import type {
	AppUpdateInfo,
	AppVersionInfo,
	ClientBonjourService,
	ClientEditConnectionConfig,
	ClientEventDefinition,
	ConnectionStatusEntry,
	ControlLocation,
	EmulatorConfig,
	EmulatorImage,
	EmulatorImageCache,
	WrappedImage,
} from './Model/Common.js'
import type {
	ClientDevicesListItem,
	OutboundSurfaceInfo,
	OutboundSurfacesUpdate,
	SurfaceGroupConfig,
	SurfacePanelConfig,
	ClientDiscoveredSurfaceInfo,
	CompanionExternalAddresses,
	SurfacesDiscoveryUpdate,
	SurfacesUpdate,
} from './Model/Surfaces.js'
import type {
	ClientImportObject,
	ClientImportSelection,
	ClientResetSelection,
	ConnectionRemappings,
} from './Model/ImportExport.js'
import type { ClientPagesInfo, PageModelChanges } from './Model/PageModel.js'
import type { ClientTriggerData, TriggersUpdate } from './Model/TriggerModel.js'
import type { CustomVariableUpdate, CustomVariablesModel } from './Model/CustomVariableModel.js'
import type { AllVariableDefinitions, VariableDefinitionUpdate } from './Model/Variables.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { UIPresetDefinition } from './Model/Presets.js'
import type { RecordSessionInfo, RecordSessionListInfo } from './Model/ActionRecorderModel.js'
import type { CloudControllerState, CloudRegionState } from './Model/Cloud.js'
import type { ModuleInfoUpdate, ClientModuleInfo, ModuleUpgradeToOtherVersion } from './Model/ModuleInfo.js'
import type { ClientConnectionsUpdate, ClientConnectionConfig, ConnectionUpdatePolicy } from './Model/Connections.js'
import type { ActionSetId } from './Model/ActionModel.js'
import type { EntityModelType, EntityOwner, SomeSocketEntityLocation } from './Model/EntityModel.js'
import { ClientEntityDefinition, EntityDefinitionUpdate } from './Model/EntityDefinitionModel.js'
import { ModuleStoreListCacheStore, ModuleStoreModuleInfoStore } from './Model/ModulesStore.js'

export interface ClientToBackendEventsMap {
	disconnect: () => never // Hack because type is missing

	'app-update-info': () => never
	'app-version-info': () => AppVersionInfo

	set_userconfig_key(key: keyof UserConfigModel, value: any): never
	reset_userconfig_key(key: keyof UserConfigModel): never
	set_userconfig_keys(values: Partial<UserConfigModel>): never
	'userconfig:get-all': () => UserConfigModel

	ssl_certificate_create(): never
	ssl_certificate_delete(): never
	ssl_certificate_renew(): never

	'bonjour:subscribe': (connectionId: string, queryId: string) => string[]
	'bonjour:unsubscribe': (subIds: string[]) => never

	'connection-debug:subscribe': (connectionId: string) => boolean
	'connection-debug:unsubscribe': (connectionId: string) => void
	'connections:set-enabled': (connectionId: string, enabled: boolean) => void

	'controls:subscribe:learn': () => string[]
	'controls:unsubscribe:learn': () => void

	'custom-variables:create': (name: string, value: string) => string | null
	'custom-variables:set-default': (name: string, value: string) => string | null
	'custom-variables:set-current': (name: string, value: string) => string | null
	'custom-variables:set-description': (name: string, description: string) => string | null
	'custom-variables:set-persistence': (name: string, value: boolean) => string | null
	'custom-variables:delete': (name: string) => void
	'custom-variables:set-order': (newNames: string[]) => void

	'event-definitions:get': () => Record<string, ClientEventDefinition | undefined>
	'custom-variables:subscribe': () => CustomVariablesModel
	'custom-variables:unsubscribe': () => void
	'modules:subscribe': () => Record<string, ClientModuleInfo>
	'modules:unsubscribe': () => void
	'connections:subscribe': () => Record<string, ClientConnectionConfig>
	'connections:unsubscribe': () => void
	'entity-definitions:subscribe': (
		type: EntityModelType
	) => Record<string, Record<string, ClientEntityDefinition | undefined> | undefined>
	'entity-definitions:unsubscribe': (type: EntityModelType) => void
	'variable-definitions:subscribe': () => AllVariableDefinitions
	'variable-definitions:unsubscribe': () => void
	'triggers:subscribe': () => Record<string, ClientTriggerData | undefined>
	'triggers:unsubscribe': () => void

	'controls:subscribe': (controlId: string) => { config: unknown; runtime: unknown } | undefined
	'controls:unsubscribe': (controlId: string) => void
	'controls:set-options-field': (controlId: string, key: string, value: any) => boolean
	'controls:hot-press': (location: ControlLocation, pressed: boolean, surfaceId: string) => void
	'controls:hot-rotate': (location: ControlLocation, rotateRight: boolean, surfaceId: string) => void
	'controls:set-style-fields': (controlId: string, styleFields: Record<string, any>) => boolean
	'controls:move': (from: ControlLocation, to: ControlLocation) => boolean
	'controls:copy': (from: ControlLocation, to: ControlLocation) => boolean
	'controls:swap': (from: ControlLocation, to: ControlLocation) => boolean
	'controls:reset': (location: ControlLocation, newType?: string) => void

	'controls:entity:set-headline': (
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		id: string,
		headline: string
	) => boolean
	'controls:entity:enabled': (
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		id: string,
		enabled: boolean
	) => boolean
	'controls:entity:set-style-selection': (
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		id: string,
		selected: string[]
	) => boolean
	'controls:entity:set-style-value': (
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		id: string,
		key: string,
		value: any
	) => boolean
	'controls:entity:learn': (controlId: string, entityLocation: SomeSocketEntityLocation, id: string) => boolean
	'controls:entity:duplicate': (controlId: string, entityLocation: SomeSocketEntityLocation, id: string) => boolean
	'controls:entity:remove': (controlId: string, entityLocation: SomeSocketEntityLocation, id: string) => boolean
	'controls:entity:set-connection': (
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		id: string,
		connectionId: string | number
	) => boolean
	'controls:entity:set-inverted': (
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		id: string,
		isInverted: boolean
	) => boolean
	'controls:entity:set-option': (
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		id: string,
		key: string,
		val: any
	) => boolean
	'controls:entity:move': (
		controlId: string,
		dragEntityLocation: SomeSocketEntityLocation,
		dragEntityId: string,
		hoverOwnerId: EntityOwner | null,
		hoverEntityLocation: SomeSocketEntityLocation,
		hoverIndex: number
	) => boolean
	'controls:entity:add': (
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		ownerId: EntityOwner | null,
		connectionId: string,
		entityTypeLabel: EntityModelType,
		entityDefinition: string
	) => boolean

	'controls:action-set:set-run-while-held': (
		controlId: string,
		stepId: string,
		newSetId: ActionSetId,
		runWhileHeld: boolean
	) => boolean
	'controls:action-set:rename': (
		controlId: string,
		stepId: string,
		oldSetId: ActionSetId,
		newSetId: ActionSetId
	) => boolean
	'controls:action-set:add': (controlId: string, stepId: string) => boolean
	'controls:action-set:remove': (controlId: string, stepId: string, setId: ActionSetId) => boolean

	'controls:step:add': (controlId: string) => string | false
	'controls:step:duplicate': (controlId: string, stepId: string) => boolean
	'controls:step:remove': (controlId: string, stepId: string) => boolean
	'controls:step:swap': (controlId: string, stepId1: string, stepId2: string) => boolean
	'controls:step:set-current': (controlId: string, stepId: string) => boolean
	'controls:step:rename': (controlId: string, stepId: string, newName: string) => boolean

	'controls:event:set-headline': (controlId: string, eventId: string, headline: string) => boolean
	'controls:event:enabled': (controlId: string, eventId: string, enabled: boolean) => boolean
	'controls:event:duplicate': (controlId: string, eventId: string) => boolean
	'controls:event:remove': (controlId: string, eventId: string) => boolean
	'controls:event:set-option': (controlId: string, eventId: string, key: string, val: any) => boolean
	'controls:event:reorder': (controlId: string, dragIndex: number, hoverIndex: number) => boolean
	'controls:event:add': (controlId: string, eventType: string) => boolean

	'triggers:create': () => string
	'triggers:clone': (controlId: string) => string | false
	'triggers:delete': (controlId: string) => boolean
	'triggers:set-order': (controlIds: string[]) => boolean
	'triggers:test': (controlId: string) => boolean

	'action-recorder:subscribe': () => Record<string, RecordSessionListInfo | undefined>
	'action-recorder:unsubscribe': () => void
	'action-recorder:session:subscribe': (sessionId: string) => RecordSessionInfo
	'action-recorder:session:unsubscribe': (sessionId: string) => void
	'action-recorder:session:recording': (sessionId: string, recording: boolean) => void
	'action-recorder:session:abort': (sessionId: string) => void
	'action-recorder:session:save-to-control': (
		sessionId: string,
		controlId: string,
		stepId: string,
		setId: ActionSetId,
		mode: 'replace' | 'append'
	) => void
	'action-recorder:session:discard-actions': (sessionId: string) => void
	'action-recorder:session:set-connections': (sessionId: string, connectionIds: string[]) => void
	'action-recorder:session:action-reorder': (sessionId: string, actionId: string, dropIndex: number) => void
	'action-recorder:session:action-set-value': (sessionId: string, actionId: string, key: string, value: any) => void
	'action-recorder:session:action-delete': (sessionId: string, actionId: string) => void
	'action-recorder:session:action-duplicate': (sessionId: string, actionId: string) => void

	'surfaces:subscribe': () => Record<string, ClientDevicesListItem | undefined>
	'surfaces:unsubscribe': () => void
	'surfaces:forget': (surfaceId: string) => string | boolean
	'surfaces:set-name': (surfaceId: string, name: string) => void
	'surfaces:add-to-group': (groupId: string | null, surfaceId: string) => void
	'surfaces:group-add': (groupName: string) => string
	'surfaces:group-remove': (groupId: string) => string
	'surfaces:group-config-set': (groupId: string, key: string, value: any) => SurfaceGroupConfig | string
	'surfaces:emulator-remove': (surfaceId: string) => boolean
	'surfaces:emulator-add': () => string
	'surfaces:rescan': () => string | undefined
	'surfaces:config-get': (surfaceId: string) => SurfacePanelConfig | null
	'surfaces:config-set': (surfaceId: string, panelConfig: SurfacePanelConfig) => SurfacePanelConfig | string
	'surfaces:group-config-get': (groupId: string) => SurfaceGroupConfig

	'surfaces:discovery:join': () => Record<string, ClientDiscoveredSurfaceInfo>
	'surfaces:discovery:leave': () => void
	'surfaces:discovery:get-external:addresses': () => CompanionExternalAddresses
	'surfaces:discovery:setup-satellite': (
		satelliteInfo: ClientDiscoveredSurfaceInfo,
		companionAddress: string
	) => string | null

	'surfaces:outbound:subscribe': () => Record<string, OutboundSurfaceInfo | undefined>
	'surfaces:outbound:unsubscribe': () => void
	'surfaces:outbound:add': (type: string, address: string, port: number | undefined, name?: string) => string
	'surfaces:outbound:remove': (id: string) => void
	'surfaces:outbound:set-name': (surfaceId: string, name: string) => void

	'emulator:startup': (emulatorId: string) => EmulatorConfig
	'emulator:press': (emulatorId: string, column: number, row: number) => void
	'emulator:release': (emulatorId: string, column: number, row: number) => void

	'logs:subscribe': () => ClientLogLine[]
	'logs:unsubscribe': () => void
	'logs:clear': () => void

	'loadsave:prepare-import': (rawFile: string | ArrayBuffer) => [err: null, config: ClientImportObject] | [err: string]
	'loadsave:abort': () => boolean
	'loadsave:reset': (config: ClientResetSelection) => 'ok'
	'loadsave:import-page': (
		toPage: number,
		fromPage: number,
		connectionRemap: ConnectionRemappings
	) => ConnectionRemappings
	'loadsave:import-triggers': (
		selectedTriggers: string[],
		connectionRemap: ConnectionRemappings,
		doReplace: boolean
	) => ConnectionRemappings
	'loadsave:control-preview': (location: ControlLocation) => string | null
	'loadsave:import-full': (config: ClientImportSelection | null) => void

	'preview:location:subscribe': (location: ControlLocation, subId: string) => WrappedImage
	'preview:location:unsubscribe': (location: ControlLocation, subId: string) => void
	'preview:button-reference:subscribe': (
		subId: string,
		location: ControlLocation | undefined,
		options: Record<string, any>
	) => string | null
	'preview:button-reference:unsubscribe': (subId: string) => void

	'pages:subscribe': () => ClientPagesInfo
	'pages:unsubscribe': () => void
	'pages:set-name': (pageNumber: number, pageName: string) => void
	'pages:insert-pages': (beforePageNumber: number, pageNames: string[]) => 'ok' | 'fail'
	'pages:delete-page': (pageNumber: number) => 'ok' | 'fail'
	'pages:move-page': (pageId: string, newPageNumber: number) => 'ok' | 'fail'
	'pages:reset-page-nav': (pageNumber: number) => 'ok'
	'pages:reset-page-clear': (pageNumber: number) => 'ok'

	'connections:add': (info: { type: string; product: string | undefined }, label: string, versionId: string) => string
	'connections:edit': (connectionId: string) => ClientEditConnectionConfig | null
	'connections:set-label-and-config': (
		connectionId: string,
		newLabel: string,
		config: Record<string, any>
	) => string | null
	'connections:set-label-and-version': (
		connectionId: string,
		newLabel: string,
		versionId: string | null,
		updatePolicy: ConnectionUpdatePolicy | null
	) => string | null
	'connections:set-module-and-version': (
		connectionId: string,
		newModuleId: string,
		versionId: string | null
	) => string | null
	'connections:set-order': (sortedIds: string[]) => void
	'connections:delete': (connectionId: string) => void
	'connections:get-statuses': () => Record<string, ConnectionStatusEntry>
	'modules:install-all-missing': () => void
	'modules:install-module-tar': (moduleTar: Uint8Array) => string | null
	'modules:install-store-module': (moduleId: string, versionId: string) => string | null
	'modules:uninstall-store-module': (moduleId: string, versionId: string) => string | null
	'modules:bundle-import:start': (name: string, size: number, checksum: string) => string | null
	'modules:bundle-import:chunk': (sessionId: string, offset: number, data: Uint8Array) => boolean
	'modules:bundle-import:complete': (sessionId: string) => boolean
	'modules:bundle-import:cancel': (sessionId: string) => void

	'modules-store:list:subscribe': () => ModuleStoreListCacheStore
	'modules-store:list:unsubscribe': () => void
	'modules-store:list:refresh': () => void
	'modules-store:info:subscribe': (moduleId: string) => ModuleStoreModuleInfoStore | null
	'modules-store:info:unsubscribe': (moduleId: string) => void
	'modules-store:info:refresh': (moduleId: string) => void
	'modules-upgrade-to-other:subscribe': (moduleId: string) => ModuleUpgradeToOtherVersion[]
	'modules-upgrade-to-other:unsubscribe': (moduleId: string) => void

	'variables:connection-values': (label: string) => CompanionVariableValues | undefined

	'presets:subscribe': () => Record<string, Record<string, UIPresetDefinition> | undefined>
	'presets:unsubscribe': () => void
	'presets:preview_render': (connectionId: string, presetId: string) => string | null
	'presets:import-to-location': (connectionId: string, presetId: string, location: ControlLocation) => boolean

	cloud_state_get: () => never
	cloud_state_set: (newState: Partial<CloudControllerState>) => never
	cloud_login: (user: string, pass: string) => never
	cloud_logout: () => never
	cloud_regenerate_uuid: () => never
	cloud_region_state_get: (id: string) => never
	cloud_region_state_set: (id: string, newState: Partial<CloudRegionState>) => never
}

export interface BackendToClientEventsMap {
	'app-update-info': (info: AppUpdateInfo) => void

	'logs:lines': (rawItems: ClientLogLine[]) => void
	'logs:clear': () => void

	'learn:add': (id: string) => void
	'learn:remove': (id: string) => void

	set_userconfig_key: (key: keyof UserConfigModel, value: any) => void
	'pages:update': (changes: PageModelChanges) => void

	'load-save:task': (task: 'reset' | 'import' | null) => void

	[id: `connection-debug:update:${string}`]: (level: string, message: string) => void

	[id: `controls:config-${string}`]: (patch: JsonPatchOperation[] | false) => void
	[id: `controls:runtime-${string}`]: (patch: JsonPatchOperation[] | false) => void
	[id: `controls:preview-${string}`]: (img: string | null) => void

	'preview:location:render': (renderLocation: ControlLocation, image: string | null, isUsed: boolean) => void
	[id: `preview:button-reference:update:${string}`]: (newImage: string | null) => void

	'action-recorder:session-list': (newSessions: JsonPatchOperation[]) => void
	[selectedSessionId: `action-recorder:session:update:${string}`]: (patch: JsonPatchOperation[]) => void

	'connections:patch': (patch: ClientConnectionsUpdate[]) => void
	'modules:patch': (patch: ModuleInfoUpdate) => void
	'surfaces:update': (patch: SurfacesUpdate[]) => void
	'surfaces:outbound:update': (patch: OutboundSurfacesUpdate[]) => void
	'triggers:update': (change: TriggersUpdate) => void
	'entity-definitions:update': (type: EntityModelType, change: EntityDefinitionUpdate) => void
	'custom-variables:update': (changes: CustomVariableUpdate[]) => void
	'variable-definitions:update': (label: string, changes: VariableDefinitionUpdate | null) => void
	'presets:update': (id: string, patch: JsonPatchOperation[] | Record<string, UIPresetDefinition> | null) => void
	'connections:patch-statuses': (patch: JsonPatchOperation[]) => void

	'surfaces:discovery:update': (update: SurfacesDiscoveryUpdate) => void

	'modules-store:list:data': (data: ModuleStoreListCacheStore) => void
	'modules-store:list:progress': (percent: number) => void
	'modules-store:info:data': (moduleId: string, data: ModuleStoreModuleInfoStore) => void
	'modules-store:info:progress': (moduleId: string, percent: number) => void
	'modules-upgrade-to-other:data': (moduleId: string, data: ModuleUpgradeToOtherVersion[]) => void
	'modules:bundle-import:progress': (sessionId: string, percent: number | null) => void

	'emulator:images': (newImages: EmulatorImage[] | EmulatorImageCache) => void
	'emulator:config': (patch: JsonPatchOperation[] | EmulatorConfig) => void

	'bonjour:service:up': (svc: ClientBonjourService) => void
	'bonjour:service:down': (subId: string, fqdn: string) => void

	cloud_state: (newState: CloudControllerState) => void
	cloud_region_state: (id: string, newState: CloudRegionState) => void
}

type ChangeSignatureToHaveCallback<T extends (...args: any[]) => any> = (
	args: Parameters<T>,
	callback: (err: Error | null, res: ReturnType<T>) => void
) => void

export type AddCallbackParamToEvents<T extends object> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any
		? ReturnType<T[K]> extends never
			? T[K]
			: ChangeSignatureToHaveCallback<T[K]>
		: never
}

export type StripNever<T extends object> = {
	[K in keyof T as T[K] extends never ? never : K]: T[K]
}

export type ClientToBackendEventsWithNoResponse = {
	[K in keyof ClientToBackendEventsListenMap as ReturnType<ClientToBackendEventsListenMap[K]> extends void
		? K
		: never]: true
}
// {
// 	[K in keyof ClientToBackendEventsMap as ClientToBackendEventsMap[K] extends (...args: any[]) => never ? never : K]: (
// 		...args: Parameters<ClientToBackendEventsMap[K]>
// 	) => void
// }

export type ClientToBackendEventsWithPromiseResponse = {
	[K in keyof ClientToBackendEventsListenMap as ReturnType<ClientToBackendEventsListenMap[K]> extends void
		? never
		: K]: true
}
// StripNever<{
// 	[K in keyof ClientToBackendEventsMap]: ClientToBackendEventsMap[K] extends (...args: any[]) => any
// 		? ReturnType<ClientToBackendEventsMap[K]> extends never
// 			? never
// 			: (...args: Parameters<ClientToBackendEventsMap[K]>) => Promise<ReturnType<ClientToBackendEventsMap[K]>>
// 		: never
// }>

export type ClientToBackendEventsListenMap = {
	[K in keyof ClientToBackendEventsMap]: ClientToBackendEventsMap[K] extends (...args: any[]) => never
		? (...args: Parameters<ClientToBackendEventsMap[K]>) => void
		: (
				...args: Parameters<ClientToBackendEventsMap[K]>
			) => Promise<ReturnType<ClientToBackendEventsMap[K]>> | ReturnType<ClientToBackendEventsMap[K]>
}
