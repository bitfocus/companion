import { OSCSomeArguments } from '../common/osc.js'
import {
	CompanionFeedbackButtonStyleResult,
	InputValue,
	InstanceStatus,
	LogLevel,
	SomeCompanionPreset,
	SomeEncodedCompanionConfigField,
	SomeEncodedCompanionInputField,
} from '../module-api/index.js'

export interface ModuleToHostEventsV0 {
	'log-message': (msg: LogMessageMessage) => void
	'set-status': (msg: SetStatusMessage) => void
	setActionDefinitions: (msg: SetActionDefinitionsMessage) => void
	setFeedbackDefinitions: (msg: SetFeedbackDefinitionsMessage) => void
	setVariableDefinitions: (msg: SetVariableDefinitionsMessage) => void
	setPresetDefinitions: (msg: SetPresetDefinitionsMessage) => void
	setVariableValues: (msg: SetVariableValuesMessage) => void
	updateFeedbackValues: (msg: UpdateFeedbackValuesMessage) => void
	saveConfig: (msg: SaveConfigMessage) => void
	'send-osc': (msg: SendOscMessage) => void
	parseVariablesInString: (msg: ParseVariablesInStringMessage) => ParseVariablesInStringResponseMessage
}

export interface HostToModuleEventsV0 {
	init: (config: unknown) => void
	destroy: (msg: Record<string, never>) => void
	updateConfig: (config: unknown) => void
	updateFeedbacks: (msg: UpdateFeedbackInstancesMessage) => void
	updateActions: (msg: UpdateActionInstancesMessage) => void
	executeAction: (msg: ExecuteActionMessage) => void
	getConfigFields: (msg: GetConfigFieldsMessage) => GetConfigFieldsResponseMessage
}

export type GetConfigFieldsMessage = Record<string, never>
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
		options: SomeEncodedCompanionInputField[] // TODO module-lib - versioned types?
	}>
}

export interface SetFeedbackDefinitionsMessage {
	feedbacks: Array<{
		id: string
		name: string
		description?: string
		options: SomeEncodedCompanionInputField[] // TODO module-lib - versioned types?
		type: 'boolean' | 'advanced'
		defaultStyle?: Partial<CompanionFeedbackButtonStyleResult>
	}>
}

export interface SetVariableDefinitionsMessage {
	variables: Array<{
		id: string
		name: string
	}>
}

export interface SetPresetDefinitionsMessage {
	presets: Array<SomeCompanionPreset>
}

export interface SetVariableValuesMessage {
	newValues: Array<{
		id: string
		value: string | undefined
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

export interface FeedbackInstance {
	id: string
	controlId: string
	feedbackId: string // aka 'type'
	options: { [key: string]: InputValue | undefined }

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

export interface ActionInstance {
	id: string
	controlId: string

	actionId: string // aka 'type'
	options: { [key: string]: InputValue | undefined }

	/** @deprecated */
	page: number
	/** @deprecated */
	bank: number
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
}
export interface ParseVariablesInStringResponseMessage {
	text: string
}
