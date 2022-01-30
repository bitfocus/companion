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
	CompanionStaticUpgradeScript,
	CompanionUpgradeToBooleanFeedbackMap,
	CompanionActionEventInfo,
	CompanionFeedbackEventInfo,
	CompanionBankPNG,
	OSCSomeArguments,
} from './instance_skel_types'

declare abstract class InstanceSkel<TConfig> {
	protected system: CompanionSystem
	public id: string
	public config: TConfig
	public label: string

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
	 * Provides the upgrade scripts to companion that are to be used for this module.
	 * These get run without any awareness of the instance class.
	 */
	static GetUpgradeScripts?(): Array<CompanionStaticUpgradeScript>
	/**
	 * Force running upgrade script from an earlier point, as specified by the value
	 * Only works when DEVELOPER=1.
	 * eg, 0 = runs the first script onwards
	 */
	static DEVELOPER_forceStartupUpgradeScript?: number
	/**
	 * A helper script to automate the bulk of the process to upgrade feedbacks from 'advanced' to 'boolean'.
	 * There are some built in rules for properties names based on the most common cases
	 * @param upgradeMap The feedbacks to upgrade and the properties to convert
	 */
	static CreateConvertToBooleanFeedbackUpgradeScript(
		upgradeMap: CompanionUpgradeToBooleanFeedbackMap
	): CompanionStaticUpgradeScript

	/**
	 * Executes the provided action.
	 * @since 1.0.0
	 */
	action?(action: CompanionActionEvent, info: CompanionActionEventInfo | null): void

	/**
	 * Processes a feedback state.
	 * @since 1.0.0
	 */
	feedback?(
		feedback: CompanionFeedbackEvent,
		bank: CompanionBankPNG | null,
		info: CompanionFeedbackEventInfo | null
	): CompanionFeedbackResult

	/**
	 * Save the current config of the module. Call this if you change any properties on this.config, so that they get persisted
	 */
	saveConfig(): void

	setActions(actions: CompanionActions): void
	setVariableDefinitions(variables: CompanionVariable[]): void
	setFeedbackDefinitions(feedbacks: CompanionFeedbacks): void
	setPresetDefinitions(presets: CompanionPreset[]): void

	/** Set the value of a variable. Pass undefined to unset it */
	setVariable(variableId: string, value: string | undefined): void
	/** Set the value of multiple variable. Use undefined to unset values */
	setVariables(variables: { [variableId: string]: string | undefined }): void
	/** Get the value of a variable from this instance */
	getVariable(variableId: string, cb: (value: string) => void): void
	/** Recheck all feedbacks of the given types. eg `self.checkFeedbacks('bank_style', 'bank_text')` or `self.checkFeedbacks` */
	checkFeedbacks(...feedbackTypes: string[]): void
	/** Recheck all feedbacks of the given ids. eg `self.checkFeedbacksById('vvbta3jtaD', 'Ba_1C3NF3q')` */
	checkFeedbacksById(...feedbackIds: string[]): void

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
	subscribeFeedbacks(type?: string): void
	/**
	 * Trigger the unsubscribe callback on all feedbacks for this instance
	 * @param feedbackId Feedback type to call for, or undefined for all
	 */
	unsubscribeFeedbacks(type?: string): void

	/**
	 * Get an array of all the actions and release_actions for this instance
	 */
	getAllActions(): CompanionActionEvent[]
	/**
	 * Trigger the subscribe callback on all actions and release_actions for this instance
	 * @param actionId Action type to call for, or undefined for all
	 */
	subscribeActions(type?: string): void
	/**
	 * Trigger the unsubscribe callback on all actions and release_actions for this instance
	 * @param actionId Action type to call for, or undefined for all
	 */
	unsubscribeActions(type?: string): void

	/**
	 * Send an osc message from the system osc sender
	 * @param host destination ip address
	 * @param port destination port number
	 * @param path message path
	 * @param args mesage arguments
	 */
	oscSend(host: string, port: number, path: string, args: OSCSomeArguments): void

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
