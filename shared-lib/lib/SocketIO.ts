import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { UserConfigModel } from './Model/UserConfigModel.js'
import type { ClientLogLine } from './Model/LogLine.js'
import type {
	ClientEditConnectionConfig,
	ConnectionStatusEntry,
	ConnectionStatusUpdate,
	ControlLocation,
} from './Model/Common.js'
import type { ClientDevicesListItem, SurfaceGroupConfig, SurfacePanelConfig, SurfacesUpdate } from './Model/Surfaces.js'
import type {
	ClientImportObject,
	ClientImportSelection,
	ClientResetSelection,
	ConnectionRemappings,
} from './Model/ImportExport.js'
import type { ClientPagesInfo, PageModelChanges } from './Model/PageModel.js'
import type { CustomVariableUpdate, CustomVariablesModel } from './Model/CustomVariableModel.js'
import type { AllVariableDefinitions, VariableDefinitionUpdate } from './Model/Variables.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { CloudControllerState, CloudRegionState } from './Model/Cloud.js'
import type { ModuleInfoUpdate, ClientModuleInfo, ModuleUpgradeToOtherVersion } from './Model/ModuleInfo.js'
import type { ClientConnectionsUpdate, ClientConnectionConfig, ConnectionUpdatePolicy } from './Model/Connections.js'
import { ModuleStoreListCacheStore, ModuleStoreModuleInfoStore } from './Model/ModulesStore.js'

export interface ClientToBackendEventsMap extends AllMultipartUploaderMethods {
	disconnect: () => never // Hack because type is missing

	set_userconfig_key(key: keyof UserConfigModel, value: any): never
	reset_userconfig_key(key: keyof UserConfigModel): never
	set_userconfig_keys(values: Partial<UserConfigModel>): never
	'userconfig:get-all': () => UserConfigModel

	ssl_certificate_create(): never
	ssl_certificate_delete(): never
	ssl_certificate_renew(): never

	'connection-debug:subscribe': (connectionId: string) => boolean
	'connection-debug:unsubscribe': (connectionId: string) => void
	'connections:set-enabled': (connectionId: string, enabled: boolean) => void

	'custom-variables:create': (name: string, value: string) => string | null
	'custom-variables:set-default': (name: string, value: string) => string | null
	'custom-variables:set-current': (name: string, value: string) => string | null
	'custom-variables:set-description': (name: string, description: string) => string | null
	'custom-variables:set-persistence': (name: string, value: boolean) => string | null
	'custom-variables:delete': (name: string) => void
	'custom-variables:reorder': (collectionId: string | null, name: string, dropIndex: number) => void

	'custom-variables:subscribe': () => CustomVariablesModel
	'custom-variables:unsubscribe': () => void
	'modules:subscribe': () => Record<string, ClientModuleInfo>
	'modules:unsubscribe': () => void
	'connections:subscribe': () => Record<string, ClientConnectionConfig>
	'connections:unsubscribe': () => void
	'variable-definitions:subscribe': () => AllVariableDefinitions
	'variable-definitions:unsubscribe': () => void

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
	'controls:import-preset': (connectionId: string, presetId: string, location: ControlLocation) => string | null

	'surfaces:subscribe': () => Record<string, ClientDevicesListItem | undefined>
	'surfaces:unsubscribe': () => void
	'surfaces:forget': (surfaceId: string) => string | boolean
	'surfaces:set-name': (surfaceId: string, name: string) => void
	'surfaces:add-to-group': (groupId: string | null, surfaceId: string) => void
	'surfaces:group-add': (baseId: string, groupName: string) => string
	'surfaces:group-remove': (groupId: string) => string
	'surfaces:group-config-set': (groupId: string, key: string, value: any) => SurfaceGroupConfig | string
	'surfaces:emulator-remove': (surfaceId: string) => boolean
	'surfaces:emulator-add': (baseId: string, name: string) => string
	'surfaces:rescan': () => string | undefined
	'surfaces:config-get': (surfaceId: string) => SurfacePanelConfig | null
	'surfaces:config-set': (surfaceId: string, panelConfig: SurfacePanelConfig) => SurfacePanelConfig | string
	'surfaces:group-config-get': (groupId: string) => SurfaceGroupConfig

	'logs:subscribe': () => ClientLogLine[]
	'logs:unsubscribe': () => void
	'logs:clear': () => void

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

	// 'preview:button-reference:subscribe': (
	// 	subId: string,
	// 	location: ControlLocation | undefined,
	// 	options: Record<string, any>
	// ) => string | null
	// 'preview:button-reference:unsubscribe': (subId: string) => void

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
		config: Record<string, any>,
		secrets: Record<string, any>,
		updatePolicy: ConnectionUpdatePolicy
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
	'connections:reorder': (collectionId: string | null, connectionId: string, dropIndex: number) => void
	'connections:delete': (connectionId: string) => void
	'connections:get-statuses': () => Record<string, ConnectionStatusEntry>

	'modules:install-all-missing': () => void
	'modules:install-module-tar': (moduleTar: Uint8Array) => string | null
	'modules:install-store-module': (moduleId: string, versionId: string) => string | null
	'modules:uninstall-store-module': (moduleId: string, versionId: string) => string | null

	'modules-store:list:subscribe': () => ModuleStoreListCacheStore
	'modules-store:list:unsubscribe': () => void
	'modules-store:list:refresh': () => void
	'modules-store:info:subscribe': (moduleId: string) => ModuleStoreModuleInfoStore | null
	'modules-store:info:unsubscribe': (moduleId: string) => void
	'modules-store:info:refresh': (moduleId: string) => void
	'modules-upgrade-to-other:subscribe': (moduleId: string) => ModuleUpgradeToOtherVersion[]
	'modules-upgrade-to-other:unsubscribe': (moduleId: string) => void

	'variables:connection-values': (label: string) => CompanionVariableValues | undefined

	'presets:preview_render': (connectionId: string, presetId: string) => string | null

	cloud_state_get: () => never
	cloud_state_set: (newState: Partial<CloudControllerState>) => never
	cloud_login: (user: string, pass: string) => never
	cloud_logout: () => never
	cloud_regenerate_uuid: () => never
	cloud_region_state_get: (id: string) => never
	cloud_region_state_set: (id: string, newState: Partial<CloudRegionState>) => never
}

type AllMultipartUploaderMethods = MultipartUploaderMethods<'modules:bundle-import', boolean> &
	MultipartUploaderMethods<'loadsave:prepare-import', [err: null, config: ClientImportObject] | [err: string]>

interface MultipartUploaderMethodsBase<TComplete> {
	start: (name: string, size: number) => string | null
	chunk: (sessionId: string, offset: number, data: Uint8Array) => boolean
	complete: (sessionId: string, checksum: string) => TComplete
	cancel: (sessionId: string) => void
}
export type MultipartUploaderMethods<Prefix extends string, TComplete> = {
	[K in keyof MultipartUploaderMethodsBase<TComplete> as `${Prefix}:${string & K}`]: MultipartUploaderMethodsBase<TComplete>[K]
}

export interface BackendToClientEventsMap {
	'logs:lines': (rawItems: ClientLogLine[]) => void
	'logs:clear': () => void

	set_userconfig_key: (key: keyof UserConfigModel, value: any) => void
	'pages:update': (changes: PageModelChanges) => void

	'load-save:task': (task: 'reset' | 'import' | null) => void
	'loadsave:prepare-import:progress': (sessionId: string, percent: number | null) => void

	[id: `connection-debug:update:${string}`]: (level: string, message: string) => void

	[id: `controls:config-${string}`]: (patch: JsonPatchOperation<any>[] | false) => void
	[id: `controls:runtime-${string}`]: (patch: JsonPatchOperation<any>[] | false) => void

	'connections:patch': (patch: ClientConnectionsUpdate[]) => void
	'modules:patch': (patch: ModuleInfoUpdate) => void
	'surfaces:update': (patch: SurfacesUpdate[]) => void
	'custom-variables:update': (changes: CustomVariableUpdate[]) => void
	'variable-definitions:update': (label: string, changes: VariableDefinitionUpdate | null) => void
	'connections:update-statuses': (patch: ConnectionStatusUpdate[]) => void

	'modules-store:list:data': (data: ModuleStoreListCacheStore) => void
	'modules-store:list:progress': (percent: number) => void
	'modules-store:info:data': (moduleId: string, data: ModuleStoreModuleInfoStore) => void
	'modules-store:info:progress': (moduleId: string, percent: number) => void
	'modules-upgrade-to-other:data': (moduleId: string, data: ModuleUpgradeToOtherVersion[]) => void
	'modules:bundle-import:progress': (sessionId: string, percent: number | null) => void

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
