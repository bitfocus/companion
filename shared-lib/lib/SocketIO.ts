import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { UserConfigModel } from './Model/UserConfigModel.js'
import type { ClientLogLine } from './Model/LogLine.js'
import type {
	ClientEditConnectionConfig,
	ConnectionStatusEntry,
	ConnectionStatusUpdate,
	ControlLocation,
} from './Model/Common.js'
import type { CustomVariableUpdate, CustomVariablesModel } from './Model/CustomVariableModel.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { CloudControllerState, CloudRegionState } from './Model/Cloud.js'
import type { ModuleInfoUpdate, ClientModuleInfo, ModuleUpgradeToOtherVersion } from './Model/ModuleInfo.js'
import type { ClientConnectionsUpdate, ClientConnectionConfig, ConnectionUpdatePolicy } from './Model/Connections.js'

export interface ClientToBackendEventsMap {
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

	'logs:subscribe': () => ClientLogLine[]
	'logs:unsubscribe': () => void
	'logs:clear': () => void

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

export interface BackendToClientEventsMap {
	'logs:lines': (rawItems: ClientLogLine[]) => void
	'logs:clear': () => void

	set_userconfig_key: (key: keyof UserConfigModel, value: any) => void

	'load-save:task': (task: 'reset' | 'import' | null) => void

	[id: `connection-debug:update:${string}`]: (level: string, message: string) => void

	[id: `controls:config-${string}`]: (patch: JsonPatchOperation<any>[] | false) => void
	[id: `controls:runtime-${string}`]: (patch: JsonPatchOperation<any>[] | false) => void

	'connections:patch': (patch: ClientConnectionsUpdate[]) => void
	'modules:patch': (patch: ModuleInfoUpdate) => void
	'custom-variables:update': (changes: CustomVariableUpdate[]) => void
	'connections:update-statuses': (patch: ConnectionStatusUpdate[]) => void

	'modules-upgrade-to-other:data': (moduleId: string, data: ModuleUpgradeToOtherVersion[]) => void

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
