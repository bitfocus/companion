/**
 * Warning: these types are intentionally semi-isolated from the module-api folder.
 * While it causes a lot of duplicate typings and requires us to do translation of types,
 * it allows for us to be selective as to whether a change impacts the module api or the host api.
 * This will allow for cleaner and more stable apis which can both evolve at different rates
 */

import { CompanionFeedbackButtonStyleResult } from '../module-api/feedback.js'
import { OSCSomeArguments } from '../common/osc.js'
import { SomeCompanionConfigField } from '../module-api/config.js'
import { LogLevel, InstanceStatus } from '../module-api/enums.js'
import { SomeCompanionInputField, InputValue, CompanionOptionValues } from '../module-api/input.js'
import { SomeCompanionPresetDefinition } from '../module-api/preset.js'
import { CompanionHTTPRequest, CompanionHTTPResponse } from '../module-api/http.js'

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
	handleHttpRequest: (msg: HandleHttpRequestMessage) => HandleHttpRequestResponseMessage
	learnAction: (msg: LearnActionMessage) => LearnActionResponseMessage
	learnFeedback: (msg: LearnFeedbackMessage) => LearnFeedbackResponseMessage
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
	hasHttpHandler: boolean
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
		hasLearn: boolean
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
	presets: Array<
		SomeCompanionPresetDefinition & {
			id: string
			// name: string
			// category: string
			// type: string
			// style:
			// feedbacks: CompanionPresetFeedback[]
			// actions: {
			// 	[key: string]: CompanionPresetAction[]
			// }
		}
	>
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
