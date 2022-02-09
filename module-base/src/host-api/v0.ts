import { OSCSomeArguments } from '../common/osc.js'
import {
	CompanionFeedbackButtonStyleResult,
	InputValue,
	InstanceStatus,
	LogLevel,
	SomeCompanionInputField,
} from '../module-api/v0/index.js'

export interface ModuleToHostEventsV0 {
	'log-message': (msg: LogMessageMessage) => void
	'set-status': (msg: SetStatusMessage) => void
	setActionDefinitions: (msg: SetActionDefinitionsMessage) => void
	setFeedbackDefinitions: (msg: SetFeedbackDefinitionsMessage) => void
	setVariableDefinitions: (msg: SetVariableDefinitionsMessage) => void
	setVariableValues: (msg: SetVariableValuesMessage) => void
	updateFeedbackValues: (msg: UpdateFeedbackValuesMessage) => void
	saveConfig: (msg: SaveConfigMessage) => void
	'send-osc': (msg: SendOscMessage) => void
}

export interface HostToModuleEventsV0 {
	init: (config: unknown) => void
	destroy: (msg: Record<string, never>) => void
	updateConfig: (config: unknown) => void
	updateFeedbacks: (msg: UpdateFeedbackInstancesMessage) => void
	updateActions: (msg: UpdateActionInstancesMessage) => void
	executeAction: (msg: ExecuteActionMessage) => void
}

export interface LogMessageMessage {
	level: LogLevel
	message: string
}

export interface SetStatusMessage {
	status: InstanceStatus | null
	message: string | null
}

export interface SetActionDefinitionsMessage {
	actions: Array<{
		id: string
		name: string
		description?: string
		options: SomeCompanionInputField[] // TODO - versioned types?
	}>
}

export interface SetFeedbackDefinitionsMessage {
	feedbacks: Array<{
		id: string
		name: string
		description?: string
		options: SomeCompanionInputField[] // TODO - versioned types?
		type: 'boolean' | 'advanced'
		defaultStyle?: Partial<CompanionFeedbackButtonStyleResult> // TODO - better
	}>
}

export interface SetVariableDefinitionsMessage {
	variables: Array<{
		id: string
		name: string
	}>
}

export interface SetVariableValuesMessage {
	newValues: Array<{
		id: string
		value: string
	}>
}

export interface ExecuteActionMessage {
	action: ActionInstance
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

	// TODO more over time

	/** @deprecated */
	deviceId: string | undefined
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
