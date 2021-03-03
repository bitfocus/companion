import {
	CompanionActions,
	CompanionInputField,
	CompanionFeedbacks,
	CompanionPreset,
	CompanionSystem,
	CompanionVariable,
	CompanionActionEvent,
	CompanionFeedbackEvent,
	CompanionFeedbackResult,
	CompanionUpgradeScript,
	CompanionActionEventInfo,
} from './instance_skel_types'

declare abstract class InstanceSkel<TConfig> {
	protected system: CompanionSystem
	public id: string
	public config: TConfig

	/**
	 * Create an instance of the module.
	 * @since 1.0.0
	 */
	constructor(system: CompanionSystem, id: string, config: TConfig)

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 * @since 1.0.0
	 */
	abstract init(): void

	/**
	 * Clean up the instance before it is destroyed.
	 * @since 1.0.0
	 */
	abstract destroy(): void

	/**
	 * Process an updated configuration array.
	 * @since 1.0.0
	 */
	abstract updateConfig(config: TConfig): void

	/**
	 * Creates the configuration fields for web config.
	 * @since 1.0.0
	 */
	abstract config_fields(): CompanionInputField[]

	/**
	 * Executes the provided action.
	 * @since 1.0.0
	 */
	action?(action: CompanionActionEvent, info: CompanionActionEventInfo): void

	/**
	 * Processes a feedback state.
	 * @since 1.0.0
	 */
	feedback?(feedback: CompanionFeedbackEvent): CompanionFeedbackResult

	/**
	 * Save the current config of the module. Call this if you change any properties on this.config, so that they get persisted
	 */
	saveConfig(): void

	addUpgradeScript(fcn: CompanionUpgradeScript<TConfig>): void

	setActions(actions: CompanionActions): void
	setVariableDefinitions(variables: CompanionVariable[]): void
	setFeedbackDefinitions(feedbacks: CompanionFeedbacks): void
	setPresetDefinitions(presets: CompanionPreset[]): void

	setVariable(variableId: string, value: string): void
	getVariable(variableId: string, cb: (value: string) => void): void
	checkFeedbacks(feedbackId?: string): void

	/**
	 * Parse a string to replace any variable references with their values.
	 * This will parse variables from any module instance, and expects the same syntax as the ui
	 */
	parseVariables(text: string, cb: (value: string | undefined) => void): void

	/**
	 * Get an array of all the feedbacks for this instance
	 */
	getAllFeedbacks(): CompanionFeedbackEvent[]
	/**
	 * Trigger the subscribe callback on all feedbacks for this instance
	 * @param feedbackId Feedback type to call for, or undefined for all
	 */
	subscribeFeedbacks(feedbackId?: string): void
	/**
	 * Trigger the unsubscribe callback on all feedbacks for this instance
	 * @param feedbackId Feedback type to call for, or undefined for all
	 */
	unsubscribeFeedbacks(feedbackId?: string): void

	/**
	 * Get an array of all the actions and release_actions for this instance
	 */
	getAllActions(): CompanionActionEvent[]
	/**
	 * Trigger the subscribe callback on all actions and release_actions for this instance
	 * @param actionId Action type to call for, or undefined for all
	 */
	subscribeActions(actionId?: string): void
	/**
	 * Trigger the unsubscribe callback on all actions and release_actions for this instance
	 * @param actionId Action type to call for, or undefined for all
	 */
	unsubscribeActions(actionId?: string): void

	status(level: null | 0 | 1 | 2, message?: string): void

	log(level: 'info' | 'warn' | 'error' | 'debug', info: string): void
	debug(formatter: string, ...args: any[]): void

	rgb(red: number, green: number, blue: number): number
	rgbRev(color: number): { r: number; g: number; b: number }

	STATUS_UNKNOWN: null
	STATUS_OK: 0
	STATUS_WARNING: 1
	STATUS_ERROR: 2

	REGEX_IP: string
	REGEX_BOOLEAN: string
	REGEX_PORT: string
	REGEX_PERCENT: string
	REGEX_FLOAT: string
	REGEX_FLOAT_OR_INT: string
	REGEX_SIGNED_FLOAT: string
	REGEX_NUMBER: string
	REGEX_SOMETHING: string
	REGEX_SIGNED_NUMBER: string
	REGEX_TIMECODE: string
	CHOICES_YESNO_BOOLEAN: any
}

export = InstanceSkel
