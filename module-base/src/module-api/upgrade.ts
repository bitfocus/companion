import { CompanionFeedbackButtonStyleResult } from './feedback.js'
import { InputValue } from './input.js'

/** For future use */
export type CompanionUpgradeContext = unknown

export interface CompanionStaticUpgradeProps<TConfig> {
	config: TConfig | null
	actions: CompanionMigrationAction[]
	feedbacks: CompanionMigrationFeedback[]
}
export interface CompanionStaticUpgradeResult<TConfig> {
	updatedConfig: TConfig | null
	updatedActions: CompanionMigrationAction[]
	updatedFeedbacks: CompanionMigrationFeedback[]
}

export type CompanionStaticUpgradeScript<TConfig> = (
	context: CompanionUpgradeContext,
	props: CompanionStaticUpgradeProps<TConfig>
) => CompanionStaticUpgradeResult<TConfig>

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
	readonly controlId: string

	actionId: string
	options: { [key: string]: InputValue | undefined }
}

export interface CompanionMigrationFeedback {
	readonly id: string
	readonly controlId: string

	feedbackId: string
	options: { [key: string]: InputValue | undefined }

	/**
	 * If the feedback is being converted to a boolean feedback, the style can be set here.
	 * If it is already a booelan feedback or is a different type of feedback, this will be ignored
	 */
	style?: Partial<CompanionFeedbackButtonStyleResult>
}

/**
 * A helper upgrade script, which does nothing.
 * Useful to replace a script which is no longer needed
 */
export const EmptyUpgradeScript: CompanionStaticUpgradeScript<any> = () => ({
	updatedConfig: null,
	updatedActions: [],
	updatedFeedbacks: [],
})

/**
 * A helper script to automate the bulk of the process to upgrade feedbacks from 'advanced' to 'boolean'.
 * There are some built in rules for properties names based on the most common cases
 * @param upgradeMap The feedbacks to upgrade and the properties to convert
 */
export function CreateConvertToBooleanFeedbackUpgradeScript(
	upgradeMap: CompanionUpgradeToBooleanFeedbackMap
): CompanionStaticUpgradeScript<unknown> {
	// Warning: the unused parameters will often be null
	return (_context, props) => {
		const changedFeedbacks: CompanionStaticUpgradeResult<unknown>['updatedFeedbacks'] = []

		for (const feedback of props.feedbacks) {
			let upgrade_rules = upgradeMap[feedback.feedbackId]
			if (upgrade_rules === true) {
				// These are some automated built in rules. They can help make it easier to migrate
				upgrade_rules = {
					bg: 'bgcolor',
					bgcolor: 'bgcolor',
					fg: 'color',
					color: 'color',
					png64: 'png64',
					png: 'png64',
				}
			}

			if (upgrade_rules) {
				if (!feedback.style) feedback.style = {}

				for (const [option_key, style_key] of Object.entries(upgrade_rules)) {
					if (feedback.options[option_key] !== undefined) {
						feedback.style[style_key] = feedback.options[option_key] as any
						delete feedback.options[option_key]

						changedFeedbacks.push(feedback)
					}
				}
			}
		}

		return {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: changedFeedbacks,
		}
	}
}
