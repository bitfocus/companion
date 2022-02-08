import { InputValue } from './input.js'

export interface CompanionUpgradeContext {
	/** Translate a key index from the old 15 key layout (5x3 grid) to the 32 key layout (8x4 grid) */
	convert15to32(key: number): number
	rgb(red: number, green: number, blue: number): number
	rgbRev(color: number): { r: number; g: number; b: number }
}

export type CompanionStaticUpgradeScript = (
	context: CompanionUpgradeContext,
	config: CompanionCoreInstanceconfig & Record<string, any>,
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

export interface CompanionCoreInstanceconfig {
	instance_type: string
	label: string
	enabled: boolean
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
