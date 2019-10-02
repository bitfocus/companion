import {
  CompanionAction, CompanionActions,
  CompanionInputField,
  CompanionFeedback, CompanionFeedbacks,
  CompanionPreset,
  CompanionSystem,
  CompanionVariable,
  CompanionActionEvent,
  CompanionFeedbackEvent, CompanionFeedbackResult
} from "./instance_skel_types"

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
  abstract init (): void

  /**
   * Clean up the instance before it is destroyed.
   * @since 1.0.0
   */
  abstract destroy(): void

  /**
   * Process an updated configuration array.
   * @since 1.0.0
   */
  abstract updateConfig (config: TConfig): void
  abstract upgradeConfig (): void

  /**
   * Creates the configuration fields for web config.
   * @since 1.0.0
   */
  abstract config_fields (): CompanionInputField[]

  /**
   * Executes the provided action.
   * @since 1.0.0
   */
  abstract action (action: CompanionActionEvent): void

  /**
   * Processes a feedback state.
   * @since 1.0.0
   */
  abstract feedback (feedback: CompanionFeedbackEvent): CompanionFeedbackResult

  setActions (actions: CompanionActions): void
  setVariableDefinitions (variables: CompanionVariable[]): void
  setFeedbackDefinitions (feedbacks: CompanionFeedbacks): void
  setPresetDefinitions (presets: CompanionPreset[]): void

  setVariable (variableId: string, value: string): void
  checkFeedbacks (feedbackId?: string): void

  status (level: null | 0 | 1 | 2, message?: string): void

  log (formatter: string, ...args: any[]): void
  debug (formatter: string, ...args: any[]): void

  rgb (red: number, green: number, blue: number): number

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