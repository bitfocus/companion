import { CompanionFeedbackButtonStyleResult } from './feedback.js'
import { CompanionOptionValues } from './input.js'

/** For future use */
export type CompanionUpgradeContext = unknown

/**
 * The items for an upgrade script to upgrade
 */
export interface CompanionStaticUpgradeProps<TConfig> {
	/**
	 * The module config to upgrade, if any
	 */
	config: TConfig | null
	/**
	 * The actions to upgrade
	 */
	actions: CompanionMigrationAction[]
	/**
	 * The feedbacks to upgrade
	 */
	feedbacks: CompanionMigrationFeedback[]
}

/**
 * The result of an upgrade script
 */
export interface CompanionStaticUpgradeResult<TConfig> {
	/**
	 * The updated config, if any changes were made
	 */
	updatedConfig: TConfig | null
	/**
	 * Any changed actions
	 */
	updatedActions: CompanionMigrationAction[]
	/**
	 * Any changed feedbacks
	 */
	updatedFeedbacks: CompanionMigrationFeedback[]
}

/**
 * The definition of an upgrade script function
 */
export type CompanionStaticUpgradeScript<TConfig> = (
	context: CompanionUpgradeContext,
	props: CompanionStaticUpgradeProps<TConfig>
) => CompanionStaticUpgradeResult<TConfig>

/**
 * An action that could be upgraded
 */
export interface CompanionMigrationAction {
	/** The unique id for this action */
	readonly id: string
	/** The unique id for the location of this action */
	readonly controlId: string

	/** The id of the action definition */
	actionId: string
	/** The execution delay of the action */
	delay?: number
	/** The user selected options for the action */
	options: CompanionOptionValues
}

/**
 * A feedback that could be upgraded
 */
export interface CompanionMigrationFeedback {
	/** The unique id for this feedback */
	readonly id: string
	/** The unique id for the location of this feedback */
	readonly controlId: string

	/** The id of the feedback definition */
	feedbackId: string
	/** The user selected options for the feedback */
	options: CompanionOptionValues

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
 * Definition of how to convert options to style properties for boolean feedbacks
 */
export interface CompanionUpgradeToBooleanFeedbackMap {
	[feedback_id: string]:
		| true
		| {
				// Option name to style property
				[option_key: string]: 'text' | 'size' | 'color' | 'bgcolor' | 'alignment' | 'pngalignment' | 'png64'
		  }
		| undefined
}

/**
 * A helper script to automate the bulk of the process to upgrade feedbacks from 'advanced' to 'boolean'.
 * There are some built in rules for properties names based on the most common cases
 * @param upgradeMap The feedbacks to upgrade and the properties to convert
 */
export function CreateConvertToBooleanFeedbackUpgradeScript<TConfig = unknown>(
	upgradeMap: CompanionUpgradeToBooleanFeedbackMap
): CompanionStaticUpgradeScript<TConfig> {
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
