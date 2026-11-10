import { EntityModelType, type ActionEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { IControlStore } from '../../Controls/IControlStore.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import { EntityManagerBase, type EntityManagerAdapter } from './EntityManagerBase.js'

/**
 * Manages the actions that are tracked by a module. An action has no value, so has nothing to report to the
 * entities which share its subscription.
 */
export class ActionEntityManager extends EntityManagerBase<ActionEntityModel> {
	constructor(
		adapter: EntityManagerAdapter<ActionEntityModel>,
		controlsStore: IControlStore,
		connectionId: string,
		variableDependencies: VariableDependencyRegistry
	) {
		super(EntityModelType.Action, adapter, controlsStore, connectionId, variableDependencies)
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
