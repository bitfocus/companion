import {
	EntityModelType,
	type FeedbackEntityModel,
	type FeedbackValue,
} from '@companion-app/shared/Model/EntityModel.js'
import type { NewFeedbackValue } from '../../Controls/Entities/Types.js'
import type { IControlStore } from '../../Controls/IControlStore.js'
import type { RenderClock } from '../../Controls/RenderClock.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import {
	EntityManagerBase,
	type EntityManagerAdapter,
	type EntitySubscriptionJoin,
	type EntityWrapper,
} from './EntityManagerBase.js'

/**
 * A feedback value reported by the module, for a subscription
 */
export interface EntityManagerFeedbackValue {
	/** The id of the subscription */
	id: string
	/** The control id as the module reported it, so it is only trusted once matched to the subscription */
	controlId: string
	value: FeedbackValue
}

/**
 * Manages the feedbacks that are tracked by a module. The module reports a value for each subscription, which is
 * given to every feedback sharing it, including those which join it later.
 */
export class FeedbackEntityManager extends EntityManagerBase<FeedbackEntityModel> {
	readonly #unsubscribeRenderClock: () => void

	/** The last value the module reported for each subscription, for a member which joins later */
	readonly #lastValues = new Map<string, FeedbackValue>()
	/** The feedbacks whose last parsed options depended on the render clock */
	readonly #clockSensitive = new WeakSet<EntityWrapper>()

	constructor(
		adapter: EntityManagerAdapter<FeedbackEntityModel>,
		controlsStore: IControlStore,
		connectionId: string,
		variableDependencies: VariableDependencyRegistry,
		renderClock: RenderClock
	) {
		super(EntityModelType.Feedback, adapter, controlsStore, connectionId, variableDependencies)
		this.#unsubscribeRenderClock = renderClock.subscribe(() => this.onRenderClockTick())
	}

	protected onOptionsParsed(wrapper: EntityWrapper, clockSensitive: boolean): void {
		if (clockSensitive) {
			this.#clockSensitive.add(wrapper)
		} else {
			this.#clockSensitive.delete(wrapper)
		}
	}

	protected onSubscriptionsJoined(joins: EntitySubscriptionJoin[]): void {
		const joinedValues: NewFeedbackValue[] = []

		for (const { subscriptionId, entityIds } of joins) {
			const subscription = this.getSubscription(subscriptionId)
			if (!subscription || !this.#lastValues.has(subscriptionId)) continue

			const value = this.#lastValues.get(subscriptionId)
			for (const entityId of entityIds) {
				joinedValues.push({ entityId, controlId: subscription.controlId, value })
			}
		}

		if (joinedValues.length > 0) this.controlsStore.updateFeedbackValues(this.connectionId, joinedValues)
	}

	protected onSubscriptionReset(subscriptionId: string): void {
		// The module will report a value for the new options
		this.#lastValues.delete(subscriptionId)
	}

	override destroy(): void {
		this.#unsubscribeRenderClock()
		super.destroy()
	}

	/**
	 * Handle feedback values reported by the module, passing each to every entity which shares the subscription
	 * @param values The values for each subscription
	 */
	handleFeedbackValues(values: EntityManagerFeedbackValue[]): void {
		const entityValues: NewFeedbackValue[] = []

		for (const { id, controlId, value } of values) {
			const subscription = this.getSubscription(id)
			// The subscription may have been removed while the value was in flight
			if (!subscription || subscription.controlId !== controlId) continue

			this.#lastValues.set(id, value)

			for (const entityId of subscription.memberIds) {
				entityValues.push({ entityId, controlId: subscription.controlId, value })
			}
		}

		if (entityValues.length > 0) this.controlsStore.updateFeedbackValues(this.connectionId, entityValues)
	}

	/**
	 * Resend all tracked feedback entities to the module.
	 * This will mark all feedbacks as unloaded, so that they are re-sent to the module.
	 * This is intended to be used when the top-bar setting changes, as the dimensions reported to the module will change.
	 */
	resendFeedbacks(): void {
		// The image size is not part of the subscription key, so it must be sent even though it looks unchanged
		this.resendAllEntities()

		this.processPending()
	}

	/**
	 * Inform the entity manager that the render clock has ticked.
	 * This will cause any feedback entities whose options depend on the render clock to be re-parsed.
	 */
	onRenderClockTick(): void {
		this.reparseReadyEntities((wrapper) => this.#clockSensitive.has(wrapper))
	}
}
