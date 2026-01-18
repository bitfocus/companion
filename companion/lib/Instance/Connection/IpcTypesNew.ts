import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { IpcWrapper } from '../Common/IpcWrapper.js'
import type {
	CompanionHTTPRequest,
	CompanionHTTPResponse,
	CompanionOptionValues,
	CompanionVariableValue,
	InstanceStatus,
	LogLevel,
} from '@companion-module/base'
import type { VariableDefinition } from '@companion-app/shared/Model/Variables.js'
import type { VariableValueEntry } from '../../Variables/Values.js'
import type { NewFeedbackValue } from '../../Controls/Controller.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type { RemoteInfo } from 'dgram'
import type {
	ActionInstance,
	FeedbackInstance,
	UpgradeActionInstance,
	UpgradeFeedbackInstance,
} from '@companion-module/host'
import type { PresetDefinition } from '@companion-app/shared/Model/Presets.js'

export type ModuleIpcWrapper = IpcWrapper<HostToModuleEventsNew, ModuleToHostEventsNew>
export type ModuleChildIpcWrapper = IpcWrapper<ModuleToHostEventsNew, HostToModuleEventsNew>

export interface ModuleToHostEventsNew {
	register: (msg: RegisterMessage) => RegisterResponseMessage

	/** The connection has a message for the Companion log */
	'log-message': (msg: LogMessageMessage) => never
	/** The connection status has changed */
	'set-status': (msg: SetStatusMessage) => never
	/** The actions available in the connection have changed */
	setActionDefinitions: (msg: SetActionDefinitionsMessage) => never
	/** The feedbacks available in the connection have changed */
	setFeedbackDefinitions: (msg: SetFeedbackDefinitionsMessage) => never
	/** The variables available in the connection have changed */
	setVariableDefinitions: (msg: SetVariableDefinitionsMessage) => never
	/** The presets provided by the connection have changed */
	setPresetDefinitions: (msg: SetPresetDefinitionsMessage) => never
	/** The connection has some new values for variables */
	setVariableValues: (msg: SetVariableValuesMessage) => never
	/** The connection has some new values for feedbacks it is running */
	updateFeedbackValues: (msg: UpdateFeedbackValuesMessage) => never
	/** The connection has updated its config, which should be persisted */
	saveConfig: (msg: SaveConfigMessage) => never
	/** Send an OSC message from the default osc listener in companion */
	'send-osc': (msg: SendOscMessage) => never
	/** When the action-recorder is running, the module has recorded an action to add to the recorded stack */
	recordAction: (msg: RecordActionMessage) => never
	/**
	 * The connection has a new value for a custom variable
	 * Note: This should only be used by a few internal modules, it is not intended for general use
	 */
	setCustomVariable: (msg: SetCustomVariableMessage) => never

	sharedUdpSocketJoin: (msg: SharedUdpSocketMessageJoin) => string
	sharedUdpSocketLeave: (msg: SharedUdpSocketMessageLeave) => void
	sharedUdpSocketSend: (msg: SharedUdpSocketMessageSend) => void
}

export interface HostToModuleEventsNew {
	/** Initialise the connection with the given config and label */
	init: (msg: InitMessage) => InitResponseMessage
	/** Cleanup the connection in preparation for the thread/process to be terminated */
	destroy: (msg: Record<string, never>) => void

	/** The connection config or label has been updated by the user */
	updateConfig: (msg: UpdateConfigMessage) => void
	/**
	 * Some feedbacks for this connection have been created/updated/removed. This will start them being executed, watching for state changes in the connection and any referenced variables
	 */
	updateFeedbacks: (msg: UpdateFeedbackInstancesMessage) => void
	/**
	 * Some actions for this connection have been created/updated/removed
	 */
	updateActions: (msg: UpdateActionInstancesMessage) => void
	/**
	 * Run the upgrade scripts for the provided actions
	 * The options objects provided here are in their 'raw' form, and can contain expressions
	 */
	upgradeActions: (msg: UpgradeActionsMessage) => UpgradeActionsResponse
	/**
	 * Run the upgrade scripts for the provided feedbacks
	 * The options objects provided here are in their 'raw' form, and can contain expressions
	 */
	upgradeFeedbacks: (msg: UpgradeFeedbacksMessage) => UpgradeFeedbacksResponse
	/** Execute an action */
	executeAction: (msg: ExecuteActionMessage) => ExecuteActionResponseMessage | undefined // This is only returned since 1.14.0
	/** Get the config fields for this connection */
	getConfigFields: (msg: GetConfigFieldsMessage) => GetConfigFieldsResponseMessage
	/** Handle an incoming HTTP request */
	handleHttpRequest: (msg: HandleHttpRequestMessage) => HandleHttpRequestResponseMessage
	/**
	 * Learn the options for an action
	 * This allows the module to update the options for an action based on the current state of the device
	 */
	learnAction: (msg: LearnActionMessage) => LearnActionResponseMessage
	/**
	 * Learn the options for an feedback
	 * This allows the module to update the options for an feedback based on the current state of the device
	 */
	learnFeedback: (msg: LearnFeedbackMessage) => LearnFeedbackResponseMessage

	/**
	 * Start or stop the action-recorder.
	 * When running, this lets the connection emit `recordAction` events when the state of the device changes.
	 * This allows users to record macros of actions for their device by changing properties on the device itself.
	 */
	startStopRecordActions: (msg: StartStopRecordActionsMessage) => void

	sharedUdpSocketMessage: (msg: SharedUdpSocketMessage) => never
	sharedUdpSocketError: (msg: SharedUdpSocketError) => never
}

export interface RegisterMessage {
	verificationToken: string
}
export interface RegisterResponseMessage {
	connectionId: string
}

export interface InitMessage {
	label: string
	isFirstInit: boolean
	config: unknown
	secrets: unknown

	lastUpgradeIndex: number
}
export interface InitResponseMessage {
	hasHttpHandler: boolean
	hasRecordActionsHandler: boolean
	newUpgradeIndex: number
	disableNewConfigLayout: boolean

	updatedConfig: unknown | undefined
	updatedSecrets: unknown | undefined
}

export type GetConfigFieldsMessage = Record<string, never>
export interface GetConfigFieldsResponseMessage {
	fields: SomeCompanionInputField[]
}

export interface LogMessageMessage {
	time: number
	source: string | undefined
	level: LogLevel
	message: string
}

export interface SetStatusMessage {
	status: InstanceStatus
	message: string | null
}

export interface SetActionDefinitionsMessage {
	actions: Record<string, ClientEntityDefinition>
}

export interface SetFeedbackDefinitionsMessage {
	feedbacks: Record<string, ClientEntityDefinition>
}

export interface SetVariableDefinitionsMessage {
	variables: VariableDefinition[]
	newValues: VariableValueEntry[]
}

export interface SetPresetDefinitionsMessage {
	presets: PresetDefinition[]
}

export interface SetVariableValuesMessage {
	newValues: VariableValueEntry[]
}

export interface ExecuteActionMessage {
	action: ActionInstance

	/** Identifier of the surface which triggered this action */
	surfaceId: string | undefined
}

export interface ExecuteActionResponseMessage {
	success: boolean
	/** If success=false, a reason for the failure */
	errorMessage: string | undefined
}

export interface UpdateFeedbackValuesMessage {
	values: NewFeedbackValue[]
}

export interface UpdateConfigMessage {
	label: string
	config: unknown | undefined
	secrets: unknown | undefined
}

export interface UpdateFeedbackInstancesMessage {
	feedbacks: { [id: string]: FeedbackInstance | null | undefined }
}

export interface UpdateActionInstancesMessage {
	actions: { [id: string]: ActionInstance | null | undefined }
}

export interface UpgradeActionsMessage {
	actions: UpgradeActionInstance[]
	defaultUpgradeIndex: number | null
}

export interface UpgradeActionsResponse {
	updatedActions: UpgradeActionInstance[]
	latestUpgradeIndex: number
}

export interface UpgradeFeedbacksMessage {
	feedbacks: UpgradeFeedbackInstance[]
	defaultUpgradeIndex: number | null
}

export interface UpgradeFeedbacksResponse {
	updatedFeedbacks: UpgradeFeedbackInstance[]
	latestUpgradeIndex: number
}

export interface SaveConfigMessage {
	config: unknown | undefined
	secrets: unknown | undefined
}

export interface SendOscMessage {
	host: string
	port: number
	path: string
	args: EncodedOSCArgument[]
}

export interface HandleHttpRequestMessage {
	request: CompanionHTTPRequest
}
export interface HandleHttpRequestResponseMessage {
	response: CompanionHTTPResponse
}

export interface LearnActionMessage {
	action: ActionInstance
}
export interface LearnActionResponseMessage {
	options: CompanionOptionValues | undefined
}

export interface LearnFeedbackMessage {
	feedback: FeedbackInstance
}
export interface LearnFeedbackResponseMessage {
	options: CompanionOptionValues | undefined
}

export interface StartStopRecordActionsMessage {
	recording: boolean
}

export interface RecordActionMessage {
	uniquenessId: string | null
	actionId: string
	options: CompanionOptionValues
	delay: number | undefined
}

export interface SetCustomVariableMessage {
	customVariableId: string
	value: CompanionVariableValue | undefined

	/** Control the variable was set from. This should always be defined, but did not exist in older versions */
	controlId: string
}

export interface SharedUdpSocketMessageJoin {
	family: 'udp4' | 'udp6'
	portNumber: number
}
export interface SharedUdpSocketMessageLeave {
	handleId: string
}
export interface SharedUdpSocketMessageSend {
	handleId: string
	message: string // base64

	address: string
	port: number
}

export interface SharedUdpSocketMessage {
	handleId: string
	portNumber: number

	message: string // base64
	source: RemoteInfo
}

export interface SharedUdpSocketError {
	handleId: string
	portNumber: number

	errorMessage: string
}

export type EncodedOSCArgument =
	| {
			type: 'i' | 'f'
			value: number
	  }
	| {
			type: 's'
			value: string
	  }
	| {
			type: 'b'
			value: string // base64 encoded
	  }
