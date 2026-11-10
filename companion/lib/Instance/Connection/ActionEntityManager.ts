import { EntityModelType, type ActionEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { IControlStore } from '../../Controls/IControlStore.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import {
	EntityManagerBase,
	type EntityManagerActionEntity,
	type EntityManagerAdapter,
	type EntityManagerUpgradeEntity,
} from './EntityManagerBase.js'

/**
 * Manages the actions that are tracked by a module. An action has no value, so has nothing to report to the
 * entities which share its subscription.
 */
export class ActionEntityManager extends EntityManagerBase<ActionEntityModel> {
	readonly #adapter: EntityManagerAdapter

	constructor(
		adapter: EntityManagerAdapter,
		controlsStore: IControlStore,
		connectionId: string,
		variableDependencies: VariableDependencyRegistry
	) {
		super(EntityModelType.Action, controlsStore, connectionId, variableDependencies)
		this.#adapter = adapter
	}

	protected async sendUpdates(payload: Map<string, EntityManagerActionEntity | null>): Promise<void> {
		return this.#adapter.updateActions(payload)
	}

	protected async sendUpgrades(
		entities: EntityManagerUpgradeEntity<ActionEntityModel>[],
		currentUpgradeIndex: number
	): ReturnType<EntityManagerAdapter['upgradeActions']> {
		return this.#adapter.upgradeActions(entities, currentUpgradeIndex)
	}

	protected onOptionsParsed(): void {
		// Only a feedback is re-parsed on the render clock
	}

	protected onSubscriptionsJoined(): void {
		// An action has no value to give the entities joining its subscription
	}

	protected onSubscriptionReset(): void {
		// An action has nothing reported by the module to forget
	}
}
