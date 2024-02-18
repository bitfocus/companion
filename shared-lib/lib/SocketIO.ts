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
	HelpDescription,
	ModuleDisplayInfo,
	WrappedImage,
} from './Model/Common.js'
import type { ClientDevicesListItem, SurfaceGroupConfig, SurfacePanelConfig } from './Model/Surfaces.js'
import type {
	ClientImportObject,
	ClientImportSelection,
	ClientResetSelection,
	InstanceRemappings,
} from './Model/ImportExport.js'
import type { PageModel } from './Model/PageModel.js'
import type { ClientTriggerData } from './Model/TriggerModel.js'
import type { CustomVariablesModel } from './Model/CustomVariableModel.js'
import type { ClientActionDefinition, InternalFeedbackDefinition } from './Model/Options.js'
import type { AllVariableDefinitions } from './Model/Variables.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { UIPresetDefinition } from './Model/Presets.js'
import type { RecordSessionInfo, RecordSessionListInfo } from './Model/ActionRecorderModel.js'

export interface ClientToBackendEventsMap {
	'app-update-info': () => never
	'app-version-info': () => AppVersionInfo

	set_userconfig_key(key: string, value: any): never
	reset_userconfig_key(key: string): never
	set_userconfig_keys(values: Partial<UserConfigModel>): never
	'userconfig:get-all': () => UserConfigModel

	ssl_certificate_create(): never
	ssl_certificate_delete(): never
	ssl_certificate_renew(): never

	'bonjour:subscribe': (connectionId: string, queryId: string) => string
	'bonjour:unsubscribe': (subId: string) => never

	'connection-debug:subscribe': (connectionId: string) => boolean
	'connection-debug:unsubscribe': (connectionId: string) => void
	'connections:set-enabled': (connectionId: string, enabled: boolean) => void

	'controls:subscribe:learn': () => string[]
	'controls:unsubscribe:learn': () => void

	'custom-variables:create': (name: string, value: string) => string | null
	'custom-variables:set-default': (name: string, value: string) => void
	'custom-variables:set-current': (name: string, value: string) => void
	'custom-variables:set-persistence': (name: string, value: boolean) => void
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
	'controls:set-options-field': (controlId: string, key: string, value: any) => void
	'controls:hot-press': (location: ControlLocation, pressed: boolean, surfaceId: string) => void
	'controls:hot-rotate': (location: ControlLocation, rotateRight: boolean, surfaceId: string) => void
	'controls:set-style-fields': (controlId: string, styleFields: Record<string, any>) => void
	'controls:move': (from: ControlLocation, to: ControlLocation) => void
	'controls:copy': (from: ControlLocation, to: ControlLocation) => void
	'controls:swap': (from: ControlLocation, to: ControlLocation) => void
	'controls:reset': (location: ControlLocation, newType?: string) => void

	'controls:feedback:set-headline': (controlId: string, feedbackId: string, headline: string) => void
	'controls:feedback:enabled': (controlId: string, feedbackId: string, enabled: boolean) => void
	'controls:feedback:set-style-selection': (controlId: string, feedbackId: string, selected: string[]) => void
	'controls:feedback:set-style-value': (controlId: string, feedbackId: string, key: string, value: any) => void
	'controls:feedback:learn': (controlId: string, feedbackId: string) => void
	'controls:feedback:duplicate': (controlId: string, feedbackId: string) => void
	'controls:feedback:remove': (controlId: string, feedbackId: string) => void
	'controls:feedback:set-inverted': (controlId: string, feedbackId: string, isInverted: boolean) => void
	'controls:feedback:set-option': (controlId: string, feedbackId: string, key: string, val: any) => void
	'controls:feedback:reorder': (controlId: string, dragIndex: number, hoverIndex: number) => void
	'controls:feedback:add': (controlId: string, connectionId: string, feedbackType: string) => void

	'controls:action:set-headline': (
		controlId: string,
		stepId: string,
		setId: string | number,
		actionId: string,
		headline: string
	) => void
	'controls:action:enabled': (
		controlId: string,
		stepId: string,
		setId: string | number,
		actionId: string,
		enabled: boolean
	) => void
	'controls:action:learn': (controlId: string, stepId: string, setId: string | number, actionId: string) => void
	'controls:action:duplicate': (controlId: string, stepId: string, setId: string | number, actionId: string) => void
	'controls:action:remove': (controlId: string, stepId: string, setId: string | number, actionId: string) => void
	'controls:action:set-delay': (
		controlId: string,
		stepId: string,
		setId: string | number,
		actionId: string,
		delay: number
	) => void
	'controls:action:set-option': (
		controlId: string,
		stepId: string,
		setId: string | number,
		actionId: string,
		key: string,
		val: any
	) => void
	'controls:action:reorder': (
		controlId: string,
		dragStepId: string,
		dragSetId: string | number,
		dragIndex: number,
		stepId: string,
		setId: string | number,
		hoverIndex: number
	) => void
	'controls:action:add': (
		controlId: string,
		stepId: string,
		setId: string | number,
		connectionId: string,
		actionType: string
	) => void

	'controls:action-set:set-run-while-held': (
		controlId: string,
		stepId: string,
		newSetId: number,
		runWhileHeld: boolean
	) => void
	'controls:action-set:rename': (controlId: string, stepId: string, oldSetId: number, newSetId: number) => void
	'controls:action-set:add': (controlId: string, stepId: string) => void
	'controls:action-set:remove': (controlId: string, stepId: string, setId: number) => void

	'controls:step:add': (controlId: string) => string
	'controls:step:remove': (controlId: string, stepId: string) => void
	'controls:step:swap': (controlId: string, stepId1: string, stepId2: string) => void
	'controls:step:set-current': (controlId: string, stepId: string) => void

	'controls:event:set-headline': (controlId: string, eventId: string, headline: string) => void
	'controls:event:enabled': (controlId: string, eventId: string, enabled: boolean) => void
	'controls:event:duplicate': (controlId: string, eventId: string) => void
	'controls:event:remove': (controlId: string, eventId: string) => void
	'controls:event:set-option': (controlId: string, eventId: string, key: string, val: any) => void
	'controls:event:reorder': (controlId: string, dragIndex: number, hoverIndex: number) => void
	'controls:event:add': (controlId: string, eventType: string) => void

	'triggers:create': () => string
	'triggers:clone': (controlId: string) => string
	'triggers:delete': (controlId: string) => void
	'triggers:set-order': (controlIds: string[]) => void
	'triggers:test': (controlId: string) => void

	'action-recorder:subscribe': () => Record<string, RecordSessionListInfo | undefined>
	'action-recorder:unsubscribe': () => void
	'action-recorder:session:subscribe': (sessionId: string) => RecordSessionInfo
	'action-recorder:session:unsubscribe': (sessionId: string) => void
	'action-recorder:session:recording': (sessionId: string, recording: boolean) => void
	'action-recorder:session:abort': (sessionId: string) => void
	'action-recorder:session:save-to-control': (
		sessionId: string,
		controlId: string,
		stepId: string | null,
		setId: string | number | null,
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
	'surfaces:forget': (surfaceId: string) => void
	'surfaces:set-name': (surfaceId: string, name: string) => void
	'surfaces:add-to-group': (groupId: string | null, surfaceId: string) => void
	'surfaces:group-add': (groupName: string) => void
	'surfaces:group-remove': (groupId: string) => void
	'surfaces:group-config-set': (groupId: string, key: string, value: any) => SurfaceGroupConfig | string
	'surfaces:emulator-remove': (surfaceId: string) => void
	'surfaces:emulator-add': () => void
	'surfaces:rescan': () => string | undefined
	'surfaces:config-get': (surfaceId: string) => SurfacePanelConfig | null
	'surfaces:config-set': (surfaceId: string, panelConfig: SurfacePanelConfig) => SurfacePanelConfig | string
	'surfaces:group-config-get': (groupId: string) => SurfaceGroupConfig

	'emulator:startup': (emulatorId: string) => EmulatorConfig
	'emulator:press': (emulatorId: string, column: number, row: number) => void
	'emulator:release': (emulatorId: string, column: number, row: number) => void

	'logs:subscribe': () => ClientLogLine[]
	'logs:unsubscribe': () => void
	'logs:clear': () => void

	'loadsave:prepare-import': (rawFile: string | ArrayBuffer) => [err: string | null, config: ClientImportObject]
	'loadsave:abort': () => void
	'loadsave:reset': (config: ClientResetSelection) => 'ok'
	'loadsave:import-page': (toPage: number, fromPage: number, instanceRemap: InstanceRemappings) => InstanceRemappings
	'loadsave:import-triggers': (
		selectedTriggers: string[],
		instanceRemap: InstanceRemappings,
		doReplace: boolean
	) => InstanceRemappings
	'loadsave:control-preview': (location: ControlLocation) => string | null
	'loadsave:import-full': (config: ClientImportSelection | null) => void
	'loadsave:reset-page-nav': (pageNumber: number) => void
	'loadsave:reset-page-clear': (pageNumber: number) => void

	'preview:location:subscribe': (location: ControlLocation, subId: string) => WrappedImage
	'preview:location:unsubscribe': (location: ControlLocation, subId: string) => void
	'preview:button-reference:subscribe': (
		subId: string,
		location: ControlLocation,
		options: Record<string, any>
	) => string | null
	'preview:button-reference:unsubscribe': (subId: string) => void

	'pages:subscribe': () => Record<number, PageModel | undefined>
	'pages:unsubscribe': () => void
	'pages:set-name': (pageNumber: number, pageName: string) => void

	'connections:add': (info: { type: string; product: string | undefined }) => string
	'connections:edit': (connectionId: string) => ClientEditConnectionConfig
	'connections:set-config': (connectionId: string, newLabel: string, config: Record<string, any>) => string | null
	'connections:set-order': (sortedIds: string[]) => void
	'connections:delete': (connectionId: string) => void
	'connections:get-statuses': () => Record<string, ConnectionStatusEntry>
	'connections:get-help': (id: string) => [err: string, result: null] | [err: null, result: HelpDescription]

	'variables:instance-values': (label: string) => CompanionVariableValues

	'presets:subscribe': () => Record<string, Record<string, UIPresetDefinition> | undefined>
	'presets:unsubscribe': () => void
	'presets:preview_render': (connectionId: string, presetId: string) => string | null
	'presets:import-to-location': (connectionId: string, presetId: string, location: ControlLocation) => void
}

export interface BackendToClientEventsMap {
	'app-update-info': (info: AppUpdateInfo) => void

	'logs:lines': (rawItems: ClientLogLine[]) => void
	'logs:clear': () => void

	'load-save:task': (task: 'reset' | 'import' | null) => void

	[id: `connection-debug:update:${string}`]: (level: string, message: string) => void

	[id: `controls:config-${string}`]: (patch: JsonPatchOperation[] | false) => void
	[id: `controls:runtime-${string}`]: (patch: JsonPatchOperation[] | false) => void
	[id: `controls:preview-${string}`]: (img: string | null) => void

	'preview:location:render': (renderLocation: ControlLocation, image: string | null, isUsed: boolean) => void
	[id: `preview:button-reference:update:${string}`]: (newImage: string) => void

	'action-recorder:session-list': (newSessions: JsonPatchOperation[]) => void
	[selectedSessionId: `action-recorder:session:update:${string}`]: (patch: JsonPatchOperation[]) => void

	'connections:patch': (patch: JsonPatchOperation[] | false) => void
	'modules:patch': (patch: JsonPatchOperation[] | false) => void
	'surfaces:patch': (patch: JsonPatchOperation[]) => void
	'triggers:update': (controlId: string, patch: JsonPatchOperation[]) => void
	'action-definitions:update': (id: string, patch: JsonPatchOperation[]) => void
	'feedback-definitions:update': (id: string, patch: JsonPatchOperation[]) => void
	'custom-variables:update': (patch: JsonPatchOperation[]) => void
	'variable-definitions:update': (label: string, patch: JsonPatchOperation[]) => void
	'presets:update': (id: string, patch: JsonPatchOperation[]) => void
	'connections:patch-statuses': (patch: JsonPatchOperation[]) => void

	'emulator:images': (newImages: EmulatorImage[]) => void
	'emulator:config': (patch: JsonPatchOperation[]) => void

	'bonjour:service:up': (svc: ClientBonjourService) => void
	'bonjour:service:down': (svc: ClientBonjourService) => void
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
