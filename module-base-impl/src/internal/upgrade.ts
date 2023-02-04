import { CompanionStaticUpgradeScript } from '@companion-module/base'
import { FeedbackInstance, ActionInstance, UpgradedDataResponseMessage } from '../host-api/api'

/**
 * Run through the upgrade scripts for the given data
 * Note: this updates the inputs in place, but the result needs to be sent back to companion
 * @param allActions Actions that may need upgrading
 * @param allFeedbacks Feedbacks that may need upgrading
 * @param defaultUpgradeIndex The lastUpgradeIndex of the connection, if known
 * @param upgradeScripts The scripts that may be run
 * @param config The config if it may need updating
 * @returns The upgraded data that needs persisting
 */
export function runThroughUpgradeScripts(
	allActions: { [id: string]: ActionInstance | undefined | null },
	allFeedbacks: { [id: string]: FeedbackInstance | undefined | null },
	defaultUpgradeIndex: number | null,
	upgradeScripts: CompanionStaticUpgradeScript<any>[],
	config: unknown | undefined
): UpgradedDataResponseMessage & {
	updatedConfig: unknown | undefined
} {
	// First we group all the actions and feedbacks by the version they currently are.
	const pendingUpgradesGrouped = new Map<number, { feedbacks: string[]; actions: string[] }>()
	const getPendingSpecialUpgrade = (i: number) => {
		let v = pendingUpgradesGrouped.get(i)
		if (!v) {
			v = { actions: [], feedbacks: [] }
			pendingUpgradesGrouped.set(i, v)
		}
		return v
	}
	for (const action of Object.values(allActions)) {
		const upgradeIndex = action?.upgradeIndex ?? defaultUpgradeIndex
		if (action && typeof upgradeIndex === 'number') {
			const pending = getPendingSpecialUpgrade(upgradeIndex)
			pending.actions.push(action.id)
		}
	}
	for (const feedback of Object.values(allFeedbacks)) {
		const upgradeIndex = feedback?.upgradeIndex ?? defaultUpgradeIndex
		if (feedback && typeof upgradeIndex === 'number') {
			const pending = getPendingSpecialUpgrade(upgradeIndex)
			pending.feedbacks.push(feedback.id)
		}
	}

	const updatedFeedbacks: UpgradedDataResponseMessage['updatedFeedbacks'] = {}
	const updatedActions: UpgradedDataResponseMessage['updatedActions'] = {}

	if (pendingUpgradesGrouped.size > 0) {
		// Figure out which script to run first. Note: we track the last index we ran, so it is offset by one
		const pendingUpgradeGroups = Array.from(pendingUpgradesGrouped.keys()).sort()
		const firstUpgradeGroup = Math.min(...pendingUpgradeGroups, defaultUpgradeIndex ?? Number.POSITIVE_INFINITY) + 1

		// Start building arrays of the ids which we are upgrading as we go
		const actionsIdsToUpgrade: string[] = []
		const feedbackIdsToUpgrade: string[] = []

		// Perform the upgrades. We start on the first batch/instance, and work our way up to the last
		const targetCount = upgradeScripts.length
		for (let i = firstUpgradeGroup; i < targetCount; i++) {
			const group = pendingUpgradesGrouped.get(i - 1)
			if (group) {
				// Update the list of objects that need upgrading
				actionsIdsToUpgrade.push(...group.actions)
				feedbackIdsToUpgrade.push(...group.feedbacks)
			}

			// Only upgrade the config, if we are past the last version we had for it
			const upgradeConfig = config !== undefined && defaultUpgradeIndex !== null && i > defaultUpgradeIndex

			// Ensure there is something to upgrade
			if (!upgradeConfig && actionsIdsToUpgrade.length === 0 && feedbackIdsToUpgrade.length === 0) continue

			// We have an upgrade script that can be run
			const fcn = upgradeScripts[i]
			const res = fcn(
				{},
				{
					config: upgradeConfig ? config : null,

					// Only pass the actions & feedbacks which need upgrading from this version
					actions: actionsIdsToUpgrade
						.map((id) => {
							const inst = allActions[id]
							if (inst) {
								return {
									id: inst.id,
									controlId: inst.controlId,

									actionId: inst.actionId,
									options: inst.options,
								}
							}
						})
						.filter((v): v is ActionInstance => !!v),

					feedbacks: feedbackIdsToUpgrade
						.map((id) => {
							const inst = allFeedbacks[id]
							if (inst) {
								return {
									id: inst.id,
									controlId: inst.controlId,

									feedbackId: inst.feedbackId,
									options: inst.options,
								}
							}
						})
						.filter((v): v is FeedbackInstance => !!v),
				}
			)

			// Apply changes
			if (upgradeConfig && res.updatedConfig) config = res.updatedConfig

			for (const action of res.updatedActions) {
				if (action) {
					const instance = allActions[action.id]
					if (instance) {
						instance.actionId = action.actionId
						instance.options = action.options

						// Mark it as changed
						updatedActions[action.id] = instance
					}
				}
			}

			for (const feedback of res.updatedFeedbacks) {
				if (feedback) {
					const instance = allFeedbacks[feedback.id]
					if (instance) {
						instance.feedbackId = feedback.feedbackId
						instance.options = feedback.options

						// Mark it as changed
						updatedFeedbacks[feedback.id] = {
							...instance,
							style: updatedFeedbacks[feedback.id]?.style ?? feedback.style,
						}
					}
				}
			}
		}

		// Make sure that everything with a upgradeIndex set is sent back
		for (const [id, action] of Object.entries(allActions)) {
			if (!updatedActions[id] && typeof action?.upgradeIndex === 'number') {
				// Send it back to acknowledge that it has been 'upgraded'
				updatedActions[id] = action
			}
		}
		for (const [id, feedback] of Object.entries(allFeedbacks)) {
			if (!updatedFeedbacks[id] && typeof feedback?.upgradeIndex === 'number') {
				// Send it back to acknowledge that it has been 'upgraded'
				updatedFeedbacks[id] = feedback
			}
		}
	}

	return {
		updatedActions,
		updatedFeedbacks,
		updatedConfig: config,
	}
}
