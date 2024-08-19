import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { UserConfigModel } from './Model/UserConfigModel.js'
import type { ClientLogLine } from './Model/LogLine.js'
import type {
	AppUpdateInfo,
	AppVersionInfo,
	ClientBonjourService,
	ClientConnectionConfig,
	ClientEditConnectionConfig,
	ClientEventDefinition,
	ConnectionStatusEntry,
	ControlLocation,
	EmulatorConfig,
	EmulatorImage,
	EmulatorImageCache,
	HelpDescription,
	WrappedImage,
} from './Model/Common.js'
import type {
	ClientDevicesListItem,
	ClientDiscoveredSurfaceInfo,
	CompanionExternalAddresses,
	SurfaceGroupConfig,
	SurfacePanelConfig,
	SurfacesDiscoveryUpdate,
	SurfacesUpdate,
} from './Model/Surfaces.js'
import type {
	ClientImportObject,
	ClientImportSelection,
	ClientResetSelection,
	InstanceRemappings,
} from './Model/ImportExport.js'
import type { PageModel } from './Model/PageModel.js'
import type { ClientTriggerData, TriggersUpdate } from './Model/TriggerModel.js'
import type { CustomVariableUpdate, CustomVariablesModel } from './Model/CustomVariableModel.js'
import type { FeedbackDefinitionUpdate, InternalFeedbackDefinition } from './Model/FeedbackDefinitionModel.js'
import type { AllVariableDefinitions, VariableDefinitionUpdate } from './Model/Variables.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { UIPresetDefinition } from './Model/Presets.js'
import type { RecordSessionInfo, RecordSessionListInfo } from './Model/ActionRecorderModel.js'
import type { ActionDefinitionUpdate, ClientActionDefinition } from './Model/ActionDefinitionModel.js'
import type { CloudControllerState, CloudRegionState } from './Model/Cloud.js'
import type { ModuleInfoUpdate, ModuleDisplayInfo } from './Model/ModuleInfo.js'

export interface ClientToBackendEventsMap {
	disconnect: () => never // Hack because type is missing

	'app-update-info': () => never
	'app-version-info': () => AppVersionInfo

	set_userconfig_key(key: string, value: any): never
	reset_userconfig_key(key: string): never
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
	'custom-variables:set-persistence': (name: string, value: boolean) => string | null
	'custom-variables:delete': (name: string) => void
	'custom-variables:set-order': (newNames: string[]) => void

	'event-definitions:get': () => Record<string, ClientEventDefinition | undefined>
	'custom-variables:subscribe': () => CustomVariablesModel
	'custom-variables:unsubscribe': () => void
	'modules:subscribe': () => Record<string, ModuleDisplayInfo>
	'modules:unsubscribe': () => void
	'connections:subscribe': () => Record<string, ClientConnectionConfig>
	'connections:unsubscribe': () => void
	'action-definitions:subscribe': () => Record<string, Record<string, ClientActionDefinition | undefined> | undefined>
	'action-definitions:unsubscribe': () => void
	'feedback-definitions:subscribe': () => Record<
		string,
		Record<string, InternalFeedbackDefinition | undefined> | undefined
	>
	'feedback-definitions:unsubscribe': () => void
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

	'controls:feedback:set-headline': (controlId: string, feedbackId: string, headline: string) => boolean
	'controls:feedback:enabled': (controlId: string, feedbackId: string, enabled: boolean) => boolean
	'controls:feedback:set-style-selection': (controlId: string, feedbackId: string, selected: string[]) => boolean
	'controls:feedback:set-style-value': (controlId: string, feedbackId: string, key: string, value: any) => boolean
	'controls:feedback:learn': (controlId: string, feedbackId: string) => boolean
	'controls:feedback:duplicate': (controlId: string, feedbackId: string) => boolean
	'controls:feedback:remove': (controlId: string, feedbackId: string) => boolean
	'controls:feedback:set-inverted': (controlId: string, feedbackId: string, isInverted: boolean) => boolean
	'controls:feedback:set-option': (controlId: string, feedbackId: string, key: string, val: any) => boolean
	'controls:feedback:move': (
		controlId: string,
		dragFeedbackId: string,
		hoverParentId: string | null,
		hoverIndex: number
	) => boolean
	'controls:feedback:add': (
		controlId: string,
		parentId: string | null,
		connectionId: string,
		feedbackType: string
	) => boolean

	'controls:action:set-headline': (
		controlId: string,
		stepId: string,
		setId: string,
		actionId: string,
		headline: string
	) => boolean
	'controls:action:enabled': (
		controlId: string,
		stepId: string,
		setId: string,
		actionId: string,
		enabled: boolean
	) => boolean
	'controls:action:learn': (controlId: string, stepId: string, setId: string, actionId: string) => boolean
	'controls:action:duplicate': (controlId: string, stepId: string, setId: string, actionId: string) => boolean
	'controls:action:remove': (controlId: string, stepId: string, setId: string, actionId: string) => boolean
	'controls:action:set-delay': (
		controlId: string,
		stepId: string,
		setId: string,
		actionId: string,
		delay: number
	) => boolean
	'controls:action:set-option': (
		controlId: string,
		stepId: string,
		setId: string,
		actionId: string,
		key: string,
		val: any
	) => boolean
	'controls:action:reorder': (
		controlId: string,
		dragStepId: string,
		dragSetId: string,
		dragIndex: number,
		stepId: string,
		setId: string,
		hoverIndex: number
	) => boolean
	'controls:action:add': (
		controlId: string,
		stepId: string,
		setId: string,
		connectionId: string,
		actionType: string
	) => boolean

	'controls:action-set:set-run-while-held': (
		controlId: string,
		stepId: string,
		newSetId: string,
		runWhileHeld: boolean
	) => boolean
	'controls:action-set:rename': (controlId: string, stepId: string, oldSetId: string, newSetId: string) => boolean
	'controls:action-set:add': (controlId: string, stepId: string) => boolean
	'controls:action-set:remove': (controlId: string, stepId: string, setId: string) => boolean

	'controls:step:add': (controlId: string) => string | false
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
		setId: string,
		mode: 'replace' | 'append'
	) => void
	'action-recorder:session:discard-actions': (sessionId: string) => void
	'action-recorder:session:set-connections': (sessionId: string, connectionIds: string[]) => void
	'action-recorder:session:action-reorder': (sessionId: string, dragIndex: number, dropIndex: number) => void
	'action-recorder:session:action-set-value': (sessionId: string, actionId: string, key: string, value: any) => void
	'action-recorder:session:action-delay': (sessionId: string, actionId: string, delay: number) => void
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

	'emulator:startup': (emulatorId: string) => EmulatorConfig
	'emulator:press': (emulatorId: string, column: number, row: number) => void
	'emulator:release': (emulatorId: string, column: number, row: number) => void

	'logs:subscribe': () => ClientLogLine[]
	'logs:unsubscribe': () => void
	'logs:clear': () => void

	'loadsave:prepare-import': (rawFile: string | ArrayBuffer) => [err: null, config: ClientImportObject] | [err: string]
	'loadsave:abort': () => boolean
	'loadsave:reset': (config: ClientResetSelection) => 'ok'
	'loadsave:import-page': (toPage: number, fromPage: number, instanceRemap: InstanceRemappings) => InstanceRemappings
	'loadsave:import-triggers': (
		selectedTriggers: string[],
		instanceRemap: InstanceRemappings,
		doReplace: boolean
	) => InstanceRemappings
	'loadsave:control-preview': (location: ControlLocation) => string | null
	'loadsave:import-full': (config: ClientImportSelection | null) => void
	'loadsave:reset-page-nav': (pageNumber: number) => 'ok'
	'loadsave:reset-page-clear': (pageNumber: number) => 'ok'

	'preview:location:subscribe': (location: ControlLocation, subId: string) => WrappedImage
	'preview:location:unsubscribe': (location: ControlLocation, subId: string) => void
	'preview:button-reference:subscribe': (
		subId: string,
		location: ControlLocation | undefined,
		options: Record<string, any>
	) => string | null
	'preview:button-reference:unsubscribe': (subId: string) => void

	'pages:subscribe': () => Record<number, PageModel | undefined>
	'pages:unsubscribe': () => void
	'pages:set-name': (pageNumber: number, pageName: string) => void

	'connections:add': (info: { type: string; product: string | undefined }) => string
	'connections:edit': (connectionId: string) => ClientEditConnectionConfig | null
	'connections:set-config': (connectionId: string, newLabel: string, config: Record<string, any>) => string | null
	'connections:set-order': (sortedIds: string[]) => void
	'connections:delete': (connectionId: string) => void
	'connections:get-statuses': () => Record<string, ConnectionStatusEntry>
	'connections:get-help': (id: string) => [err: string, result: null] | [err: null, result: HelpDescription]

	'variables:instance-values': (label: string) => CompanionVariableValues | undefined

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

	set_userconfig_key: (key: string, value: any) => void
	'pages:update': (page: number, info: PageModel) => void

	'load-save:task': (task: 'reset' | 'import' | null) => void

	[id: `connection-debug:update:${string}`]: (level: string, message: string) => void

	[id: `controls:config-${string}`]: (patch: JsonPatchOperation[] | false) => void
	[id: `controls:runtime-${string}`]: (patch: JsonPatchOperation[] | false) => void
	[id: `controls:preview-${string}`]: (img: string | null) => void

	'preview:location:render': (renderLocation: ControlLocation, image: string | null, isUsed: boolean) => void
	[id: `preview:button-reference:update:${string}`]: (newImage: string | null) => void

	'action-recorder:session-list': (newSessions: JsonPatchOperation[]) => void
	[selectedSessionId: `action-recorder:session:update:${string}`]: (patch: JsonPatchOperation[]) => void

	'connections:patch': (patch: JsonPatchOperation[] | false) => void
	'modules:patch': (patch: ModuleInfoUpdate) => void
	'surfaces:update': (patch: SurfacesUpdate[]) => void
	'triggers:update': (change: TriggersUpdate) => void
	'action-definitions:update': (change: ActionDefinitionUpdate) => void
	'feedback-definitions:update': (change: FeedbackDefinitionUpdate) => void
	'custom-variables:update': (changes: CustomVariableUpdate[]) => void
	'variable-definitions:update': (label: string, changes: VariableDefinitionUpdate | null) => void
	'presets:update': (id: string, patch: JsonPatchOperation[] | Record<string, UIPresetDefinition> | null) => void
	'connections:patch-statuses': (patch: JsonPatchOperation[]) => void

	'surfaces:discovery:update': (update: SurfacesDiscoveryUpdate) => void

	'emulator:images': (newImages: EmulatorImage[] | EmulatorImageCache) => void
	'emulator:config': (patch: JsonPatchOperation[] | EmulatorConfig) => void

	'bonjour:service:up': (svc: ClientBonjourService) => void
	'bonjour:service:down': (svc: ClientBonjourService) => void

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
