import { OSCSomeArguments } from '../common/osc.js'
import {
	CompanionFeedbackButtonStyleResult,
	InputValue,
	InstanceStatus,
	LogLevel,
	SomeCompanionConfigField,
	SomeCompanionInputField,
	SomeCompanionPresetDefinition,
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
	upgradedItems: (msg: UpgradedDataResponseMessage) => void
}

export interface HostToModuleEventsV0 {
	init: (msg: InitMessage) => InitResponseMessage
	destroy: (msg: Record<string, never>) => void
	updateConfig: (config: unknown) => void
	updateFeedbacks: (msg: UpdateFeedbackInstancesMessage) => void
	updateActions: (msg: UpdateActionInstancesMessage) => void
	executeAction: (msg: ExecuteActionMessage) => void
	getConfigFields: (msg: GetConfigFieldsMessage) => GetConfigFieldsResponseMessage
}

export type EncodeIsVisible<T extends SomeCompanionInputField> = Omit<T, 'isVisible'> & {
	isVisibleFn?: string
}

export interface InitMessage {
	label: string
	config: unknown

	lastUpgradeIndex: number

	feedbacks: { [id: string]: FeedbackInstance | undefined }
	actions: { [id: string]: ActionInstance | undefined }
}
export interface InitResponseMessage {
	newUpgradeIndex: number

	updatedConfig: unknown | undefined
}

export interface UpgradedDataResponseMessage {
	updatedFeedbacks: {
		[id: string]: (FeedbackInstanceBase & { style?: Partial<CompanionFeedbackButtonStyleResult> }) | undefined
	}
	updatedActions: { [id: string]: ActionInstanceBase | undefined }
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

export type SomeEncodedCompanionInputField = EncodeIsVisible<SomeCompanionInputField>

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
	presets: Array<SomeCompanionPresetDefinition>
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

	actionId: string // aka 'type'
	options: { [key: string]: InputValue | undefined }
}
export interface ActionInstance extends ActionInstanceBase {
	controlId: string

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
