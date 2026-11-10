import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { IControlStore } from '../../Controls/IControlStore.js'
import type { RenderClock } from '../../Controls/RenderClock.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import { ActionEntityManager } from './ActionEntityManager.js'
import type { EntityManagerAdapter } from './EntityManagerBase.js'
import { FeedbackEntityManager } from './FeedbackEntityManager.js'

/** The entity managers of a connection, by the type of entity each manages */
export interface ConnectionEntityManagers {
	readonly [EntityModelType.Action]: ActionEntityManager
	readonly [EntityModelType.Feedback]: FeedbackEntityManager
}

/**
 * Create the entity managers for a connection
 */
export function createConnectionEntityManagers(
	adapter: EntityManagerAdapter,
	controlsStore: IControlStore,
	connectionId: string,
	renderClock: RenderClock,
	variableDependencies: VariableDependencyRegistry
): ConnectionEntityManagers {
	return {
		[EntityModelType.Action]: new ActionEntityManager(adapter, controlsStore, connectionId, variableDependencies),
		[EntityModelType.Feedback]: new FeedbackEntityManager(
			adapter,
			controlsStore,
			connectionId,
			variableDependencies,
			renderClock
		),
	}
}

/** Start processing the entities of every manager */
export function startConnectionEntityManagers(managers: ConnectionEntityManagers, currentUpgradeIndex: number): void {
	managers[EntityModelType.Action].start(currentUpgradeIndex)
	managers[EntityModelType.Feedback].start(currentUpgradeIndex)
}

/** Destroy every manager */
export function destroyConnectionEntityManagers(managers: ConnectionEntityManagers): void {
	managers[EntityModelType.Action].destroy()
	managers[EntityModelType.Feedback].destroy()
}
