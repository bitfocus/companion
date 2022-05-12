import { InputValue } from './input.js'

/** For future use */
export type CompanionUpgradeContext = unknown

export type CompanionStaticUpgradeScript<TConfig> = (
	context: CompanionUpgradeContext,
	config: TConfig | null,
	affected_actions: CompanionMigrationAction[],
	affected_feedbacks: CompanionMigrationFeedback[]
) => boolean

export interface CompanionUpgradeToBooleanFeedbackMap {
	[feedback_id: string]:
		| true
		| {
				// Option name to style property
				[option_key: string]: 'text' | 'size' | 'color' | 'bgcolor' | 'alignment' | 'pngalignment' | 'png64'
		  }
		| undefined
}

export interface CompanionMigrationAction {
	readonly id: string
	readonly instance: string
	label: string
	action: string
	options: { [key: string]: InputValue | undefined }
}

export interface CompanionMigrationFeedback {
	readonly id: string
	readonly instance_id: string
	type: string
	options: { [key: string]: InputValue | undefined }
}
