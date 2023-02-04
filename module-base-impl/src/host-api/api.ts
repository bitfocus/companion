/**
 * Warning: these types are intentionally semi-isolated from the module-api folder.
 * While it causes a lot of duplicate typings and requires us to do translation of types,
 * it allows for us to be selective as to whether a change impacts the module api or the host api.
 * This will allow for cleaner and more stable apis which can both evolve at different rates
 */

import {
	CompanionInputFieldBase,
	CompanionFeedbackButtonStyleResult,
	SomeCompanionConfigField,
	LogLevel,
	InstanceStatus,
	SomeCompanionActionInputField,
	SomeCompanionFeedbackInputField,
	CompanionButtonPresetDefinition,
	InputValue,
	OSCSomeArguments,
	CompanionHTTPRequest,
	CompanionHTTPResponse,
	CompanionOptionValues,
	CompanionVariableValue,
} from '@companion-module/base'

export interface ModuleToHostEventsV0 {
	'log-message': (msg: LogMessageMessage) => never
	'set-status': (msg: SetStatusMessage) => never
	setActionDefinitions: (msg: SetActionDefinitionsMessage) => never
	setFeedbackDefinitions: (msg: SetFeedbackDefinitionsMessage) => never
	setVariableDefinitions: (msg: SetVariableDefinitionsMessage) => never
	setPresetDefinitions: (msg: SetPresetDefinitionsMessage) => never
	setVariableValues: (msg: SetVariableValuesMessage) => never
	updateFeedbackValues: (msg: UpdateFeedbackValuesMessage) => never
	saveConfig: (msg: SaveConfigMessage) => never
	'send-osc': (msg: SendOscMessage) => never
	parseVariablesInString: (msg: ParseVariablesInStringMessage) => ParseVariablesInStringResponseMessage
	upgradedItems: (msg: UpgradedDataResponseMessage) => void
	recordAction: (msg: RecordActionMessage) => never
	setCustomVariable: (msg: SetCustomVariableMessage) => never
}

export interface HostToModuleEventsV0 {
	init: (msg: InitMessage) => InitResponseMessage
	destroy: (msg: Record<string, never>) => void
	updateConfig: (config: unknown) => void
	updateFeedbacks: (msg: UpdateFeedbackInstancesMessage) => void
	updateActions: (msg: UpdateActionInstancesMessage) => void
	executeAction: (msg: ExecuteActionMessage) => void
	getConfigFields: (msg: GetConfigFieldsMessage) => GetConfigFieldsResponseMessage
	handleHttpRequest: (msg: HandleHttpRequestMessage) => HandleHttpRequestResponseMessage
	learnAction: (msg: LearnActionMessage) => LearnActionResponseMessage
	learnFeedback: (msg: LearnFeedbackMessage) => LearnFeedbackResponseMessage
	startStopRecordActions: (msg: StartStopRecordActionsMessage) => void
	variablesChanged: (msg: VariablesChangedMessage) => never
}

export type EncodeIsVisible<T extends CompanionInputFieldBase> = Omit<T, 'isVisible'> & {
	isVisibleFn?: string
}

export interface InitMessage {
	label: string
	isFirstInit: boolean
	config: unknown

	lastUpgradeIndex: number

	feedbacks: { [id: string]: FeedbackInstance | undefined }
	actions: { [id: string]: ActionInstance | undefined }
}
export interface InitResponseMessage {
	hasHttpHandler: boolean
	hasRecordActionsHandler: boolean
	newUpgradeIndex: number

	updatedConfig: unknown | undefined
}

export interface UpgradedDataResponseMessage {
	updatedFeedbacks: {
		[id: string]:
			| (FeedbackInstanceBase & {
					controlId: string
					style?: Partial<CompanionFeedbackButtonStyleResult>
			  })
			| undefined
	}
	updatedActions: { [id: string]: (ActionInstanceBase & { controlId: string }) | undefined }
}

export type GetConfigFieldsMessage = Record<string, never>
export type SomeEncodedCompanionConfigField = EncodeIsVisible<SomeCompanionConfigField>
export interface GetConfigFieldsResponseMessage {
	fields: SomeEncodedCompanionConfigField[]
}
export interface LogMessageMessage {
	level: LogLevel
	message: string
}

export interface SetStatusMessage {
	status: InstanceStatus
	message: string | null
}

export interface SetActionDefinitionsMessage {
	actions: Array<{
		id: string
		name: string
		description?: string
		options: EncodeIsVisible<SomeCompanionActionInputField>[] // TODO module-lib - versioned types?
		hasLearn: boolean
	}>
}

export interface SetFeedbackDefinitionsMessage {
	feedbacks: Array<{
		id: string
		name: string
		description?: string
		options: EncodeIsVisible<SomeCompanionFeedbackInputField>[] // TODO module-lib - versioned types?
		type: 'boolean' | 'advanced'
		defaultStyle?: Partial<CompanionFeedbackButtonStyleResult>
		hasLearn: boolean
	}>
}

export interface SetVariableDefinitionsMessage {
	variables: Array<{
		id: string
		name: string
	}>
}

export interface SetPresetDefinitionsMessage {
	presets: Array<CompanionButtonPresetDefinition & { id: string }>
}

export interface SetVariableValuesMessage {
	newValues: Array<{
		id: string
		value: string | number | boolean | undefined
	}>
}

export interface ExecuteActionMessage {
	action: ActionInstance

	/** @deprecated */
	deviceId: string | undefined
}

export interface UpdateFeedbackValuesMessage {
	values: Array<{
		id: string
		controlId: string
		value: boolean | Partial<CompanionFeedbackButtonStyleResult> | undefined
	}>
}

export interface FeedbackInstanceBase {
	id: string

	// If this is pending being run through upgrade scripts, the version it needs upgraded from is tracked here
	upgradeIndex: number | null
	disabled: boolean

	feedbackId: string // aka 'type'
	options: { [key: string]: InputValue | undefined }
}

export interface FeedbackInstance extends FeedbackInstanceBase {
	controlId: string

	/** If control supports an imageBuffer, the dimensions the buffer must be */
	image?: {
		width: number
		height: number
	}

	/** @deprecated */
	page: number
	/** @deprecated */
	bank: number

	/** @deprecated */
	rawBank: any
}

export interface UpdateFeedbackInstancesMessage {
	feedbacks: { [id: string]: FeedbackInstance | null | undefined }
}

export interface ActionInstanceBase {
	id: string

	// If this is pending being run through upgrade scripts, the version it needs upgraded from is tracked here
	upgradeIndex: number | null
	disabled: boolean

	actionId: string // aka 'type'
	options: { [key: string]: InputValue | undefined }
}
export interface ActionInstance extends ActionInstanceBase {
	controlId: string

	/** @deprecated */
	page: number | null
	/** @deprecated */
	bank: number | null
}

export interface UpdateActionInstancesMessage {
	actions: { [id: string]: ActionInstance | null | undefined }
}

export interface SaveConfigMessage {
	config: unknown
}

export interface SendOscMessage {
	host: string
	port: number
	path: string
	args: OSCSomeArguments
}

export interface ParseVariablesInStringMessage {
	text: string
	controlId: string | undefined
	feedbackInstanceId: string | undefined
	actionInstanceId: string | undefined
}
export interface ParseVariablesInStringResponseMessage {
	text: string
	variableIds: string[] | undefined
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
}

export interface SetCustomVariableMessage {
	customVariableId: string
	value: CompanionVariableValue
}

export interface VariablesChangedMessage {
	variablesIds: string[]
}
