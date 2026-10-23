import { createHash } from 'node:crypto'
import debounceFn from 'debounce-fn'
import { nanoid } from 'nanoid'
import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
	type FeedbackValue,
	type ReplaceableActionEntityModel,
	type ReplaceableFeedbackEntityModel,
	type SomeEntityModel,
	type SomeReplaceableEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { createStableObjectHash } from '@companion-app/shared/Util/Hash.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { ControlEntityInstance } from '../../Controls/Entities/EntityInstance.js'
import type { NewFeedbackValue } from '../../Controls/Entities/Types.js'
import type { IControlStore } from '../../Controls/IControlStore.js'
import type { RenderClock } from '../../Controls/RenderClock.js'
import LogController, { type Logger } from '../../Log/Controller.js'

const MAX_UPDATE_PER_BATCH = 50 // Arbitrary limit to avoid sending too much data in one go

// The maximum number of update/upgrade IPC batches to have in flight to the module at once.
// Each IPC call has its own timeout that starts ticking when it is sent, so firing every batch at
// once (as a large import does) makes the later batches time out while they wait their turn. Limiting
// the concurrency spreads those timers out and keeps the module from being flooded.
const MAX_INFLIGHT_BATCHES = 5

enum EntityState {
	UNLOADED = 'UNLOADED',
	UPGRADING = 'UPGRADING',
	UPGRADING_INVALIDATED = 'UPGRADING_INVALIDATED',
	READY = 'READY',
	PENDING_DELETE = 'PENDING_DELETE',
}

interface EntityWrapper {
	/** A unique id for this wrapper, so that we know if the entity was replaced/deleted */
	readonly wrapperId: string
	readonly entity: WeakRef<ControlEntityInstance>
	readonly controlId: string

	state: EntityState
	/** The id of the subscription this entity is a member of, if it is subscribed to the module */
	subscriptionId?: string
	/**
	 * Whether the subscription must be sent to the module again even if it is unchanged, as something which isn't
	 * part of its id has changed (eg the image size of a feedback)
	 */
	resendRequested?: boolean
	lastReferencedVariableIds?: ReadonlySet<string>
	/** Whether the last parsed options for this feedback entity depended on the render clock */
	lastClockSensitive?: boolean
}

/**
 * A subscription sent to the module. Entities in the same control which parse to the same options share a
 * subscription, so the module only sees it once. Its id is derived from what makes it unique, so no member
 * owns it and it is unaffected by members coming and going.
 */
interface EntitySubscription {
	readonly controlId: string
	readonly type: EntityModelType
	/** The ids of the entities which share this subscription */
	readonly memberIds: Set<string>
	/** The last value the module reported for this subscription, for a member which joins later */
	lastValue?: { value: FeedbackValue }
}

/**
 * A feedback value reported by the module, for a subscription
 */
export interface EntityManagerFeedbackValue {
	/** The id of the subscription */
	id: string
	controlId: string
	value: FeedbackValue
}

/**
 * Get the id of the module subscription for an entity, from what makes the subscription unique
 * @param controlId The control the entity belongs to
 * @param entityModel The entity
 * @param parsedOptions The options of the entity, as parsed for the module
 */
export function getEntitySubscriptionId(
	controlId: string,
	entityModel: SomeEntityModel,
	parsedOptions: CompanionOptionValues
): string {
	const key = JSON.stringify([
		controlId,
		entityModel.type,
		entityModel.definitionId,
		createStableObjectHash(parsedOptions),
		// Older modules are told whether a feedback is inverted
		entityModel.type === EntityModelType.Feedback ? (entityModel.isInverted ?? null) : null,
	])
	return createHash('sha256').update(key).digest('base64url').slice(0, 22)
}

export interface EntityManagerActionEntity {
	controlId: string
	entity: ActionEntityModel
	parsedOptions: CompanionOptionValues
}
export interface EntityManagerFeedbackEntity {
	controlId: string
	entity: FeedbackEntityModel
	parsedOptions: CompanionOptionValues
}

export interface EntityManagerAdapter {
	/** Send changes to the subscriptions, keyed by the id of each subscription. `null` deletes a subscription */
	updateActions: (actions: Map<string, EntityManagerActionEntity | null>) => Promise<void>
	updateFeedbacks: (feedbacks: Map<string, EntityManagerFeedbackEntity | null>) => Promise<void>

	upgradeActions: (
		actions: Omit<EntityManagerActionEntity, 'parsedOptions'>[],
		currentUpgradeIndex: number
	) => Promise<ReplaceableActionEntityModel[]>

	upgradeFeedbacks: (
		feedbacks: Omit<EntityManagerFeedbackEntity, 'parsedOptions'>[],
		currentUpgradeIndex: number
	) => Promise<ReplaceableFeedbackEntityModel[]>
}

/**
 * This class is responsible for managing the entities that are tracked by the module
 * With this, it will ensure that the entities are run through the upgrade scripts as needed, and also
 * have the options parsed (by as much as companion supports) before being sent to the module for subscription callbacks
 */
export class ConnectionEntityManager {
	readonly #logger: Logger

	readonly #adapter: EntityManagerAdapter
	readonly controlsStore: IControlStore

	readonly #connectionId: string
	readonly #entities = new Map<string, EntityWrapper>()
	readonly #subscriptions = new Map<string, EntitySubscription>()

	// Before the connection is ready, we need to not send any updates
	#ready = false
	#currentUpgradeIndex = 0

	// Queue of update/upgrade batches waiting to be sent, and the number currently in flight.
	// This bounds how many IPC calls are outstanding at once, see MAX_INFLIGHT_BATCHES.
	readonly #batchQueue: Array<() => Promise<void>> = []
	#inflightBatches = 0

	readonly #unsubscribeRenderClock: () => void

	constructor(
		adapter: EntityManagerAdapter,
		controlsStore: IControlStore,
		connectionId: string,
		renderClock: RenderClock
	) {
		this.#logger = LogController.createLogger(`Instance/Connection/EntityManager/${connectionId}`)
		this.#connectionId = connectionId
		this.#adapter = adapter
		this.controlsStore = controlsStore
		this.#unsubscribeRenderClock = renderClock.subscribe(() => this.onRenderClockTick())
	}

	readonly #debounceProcessPending = debounceFn(
		() => {
			if (!this.#ready) return

			let actionIdsInThisBatch = new Map<string, string>()
			let feedbackIdsInThisBatch = new Map<string, string>()
			let upgradeActions: Omit<EntityManagerActionEntity, 'parsedOptions'>[] = []
			let upgradeFeedbacks: Omit<EntityManagerFeedbackEntity, 'parsedOptions'>[] = []

			let updateActionsPayload = new Map<string, EntityManagerActionEntity | null>()
			let updateFeedbacksPayload = new Map<string, EntityManagerFeedbackEntity | null>()

			// Values of existing subscriptions, for entities which have joined them
			const joinedFeedbackValues: NewFeedbackValue[] = []

			const setSubscriptionPayload = (
				subscriptionId: string,
				payload: EntityManagerActionEntity | EntityManagerFeedbackEntity | null,
				type: EntityModelType
			) => {
				switch (type) {
					case EntityModelType.Action:
						updateActionsPayload.set(subscriptionId, payload as EntityManagerActionEntity | null)
						break
					case EntityModelType.Feedback:
						updateFeedbacksPayload.set(subscriptionId, payload as EntityManagerFeedbackEntity | null)
						break
					default:
						assertNever(type)
						this.#logger.warn('Unknown entity type', type)
				}
			}

			/** Remove an entity from its subscription, deleting the subscription if it was the last member */
			const leaveSubscription = (entityId: string, wrapper: EntityWrapper) => {
				const subscriptionId = wrapper.subscriptionId
				if (subscriptionId === undefined) return
				wrapper.subscriptionId = undefined

				const subscription = this.#subscriptions.get(subscriptionId)
				if (!subscription) return

				subscription.memberIds.delete(entityId)
				if (subscription.memberIds.size === 0) {
					this.#subscriptions.delete(subscriptionId)
					setSubscriptionPayload(subscriptionId, null, subscription.type)
				}
			}

			/** Add an entity to the subscription for its parsed options, creating the subscription if needed */
			const joinSubscription = (
				entityId: string,
				wrapper: EntityWrapper,
				payload: EntityManagerActionEntity | EntityManagerFeedbackEntity,
				resendRequested: boolean
			) => {
				const subscriptionId = getEntitySubscriptionId(wrapper.controlId, payload.entity, payload.parsedOptions)

				if (wrapper.subscriptionId === subscriptionId) {
					// Already a member. The id covers everything the module is sent, so it only needs sending again if asked for
					if (resendRequested) setSubscriptionPayload(subscriptionId, payload, payload.entity.type)
					return
				}

				leaveSubscription(entityId, wrapper)
				wrapper.subscriptionId = subscriptionId

				const subscription = this.#subscriptions.get(subscriptionId)
				if (subscription) {
					// The module already knows about this subscription, so the entity can use its current value
					subscription.memberIds.add(entityId)
					if (subscription.lastValue) {
						joinedFeedbackValues.push({
							entityId: entityId,
							controlId: subscription.controlId,
							value: subscription.lastValue.value,
						})
					}
				} else {
					this.#subscriptions.set(subscriptionId, {
						controlId: wrapper.controlId,
						type: payload.entity.type,
						memberIds: new Set([entityId]),
					})
					setSubscriptionPayload(subscriptionId, payload, payload.entity.type)
				}
			}

			const pushEntityToUpgrade = (wrapper: EntityWrapper, entity: ControlEntityInstance) => {
				this.#logger.silly(
					`Pushing entity ${entity.id} in control ${wrapper.controlId} for upgrade from ${entity.upgradeIndex} to ${this.#currentUpgradeIndex}`
				)

				const entityModel = entity.asEntityModel(false)
				switch (entityModel.type) {
					case EntityModelType.Action:
						actionIdsInThisBatch.set(entity.id, wrapper.wrapperId)
						upgradeActions.push({
							controlId: wrapper.controlId,
							entity: entityModel,
						})
						break
					case EntityModelType.Feedback:
						feedbackIdsInThisBatch.set(entity.id, wrapper.wrapperId)
						upgradeFeedbacks.push({
							controlId: wrapper.controlId,
							entity: entityModel,
						})
						break
					default:
						assertNever(entityModel)
						this.#logger.warn('Unknown entity type', entity.type)
						return
				}

				// If the payloads are getting large, send them now and reset
				// We do this to avoid sending too much data in one go, which can cause issues with IPC
				// The exact limits here are somewhat arbitrary, but should be sufficient for most use cases
				if (actionIdsInThisBatch.size > MAX_UPDATE_PER_BATCH) {
					this.#sendUpgradeActionsBatch(actionIdsInThisBatch, upgradeActions)

					// Start a new batch
					actionIdsInThisBatch = new Map()
					upgradeActions = []
				}
				if (feedbackIdsInThisBatch.size > MAX_UPDATE_PER_BATCH) {
					this.#sendUpgradeFeedbacksBatch(feedbackIdsInThisBatch, upgradeFeedbacks)

					// Start a new batch
					feedbackIdsInThisBatch = new Map()
					upgradeFeedbacks = []
				}
			}

			// First, look over all the entiites and figure out what needs to be done to each
			for (const [entityId, wrapper] of this.#entities) {
				switch (wrapper.state) {
					case EntityState.UNLOADED: {
						const entity = wrapper.entity.deref()
						if (!entity) {
							this.#logger.warn(`Entity ${wrapper.wrapperId} has been garbage collected, skipping upgrade`)
							this.#entities.delete(entityId)
							leaveSubscription(entityId, wrapper)
							continue
						}

						// The entity is unloaded, it either needs to be upgraded or loaded
						if (entity.upgradeIndex === undefined || entity.upgradeIndex === this.#currentUpgradeIndex) {
							wrapper.state = EntityState.READY
							const resendRequested = !!wrapper.resendRequested
							wrapper.resendRequested = false

							if (entity.disabled) {
								// Disabled entities should not be subscribed to the module
								leaveSubscription(entityId, wrapper)
								continue
							}

							const entityDefinition = entity.getEntityDefinition()
							if (!entityDefinition || !entityDefinition.hasLifecycleFunctions) {
								// The entity does not have lifecycle functions, so we can skip informing the module about it
								leaveSubscription(entityId, wrapper)
								continue
							}

							const entityModel = entity.asEntityModel(false)

							let updateOptions: CompanionOptionValues | undefined
							try {
								// Parse the options and track the variables referenced
								const parser = this.controlsStore.createVariablesAndExpressionParser(wrapper.controlId, null)
								const parseRes = parser.parseEntityOptions(entityDefinition, entityModel.options, wrapper.controlId)
								if (!parseRes.ok) {
									this.#logger.warn(
										`Failed to parse options for entity ${entity.id} in control ${wrapper.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
									)
								} else {
									updateOptions = parseRes.parsedOptions
								}
								wrapper.lastReferencedVariableIds = parseRes.referencedVariableIds
								wrapper.lastClockSensitive =
									entityModel.type === EntityModelType.Feedback ? parseRes.clockSensitive : false
							} catch (e) {
								this.#logger.warn(
									`Error parsing options for entity ${entity.id} in control ${wrapper.controlId}, marking as inactive: ${stringifyError(e, false)}`
								)
							}

							if (updateOptions) {
								joinSubscription(
									entityId,
									wrapper,
									{
										controlId: wrapper.controlId,
										entity: entityModel,
										parsedOptions: updateOptions,
									} as EntityManagerActionEntity | EntityManagerFeedbackEntity,
									resendRequested
								)
							} else {
								// The entity is inactive until its options can be parsed
								leaveSubscription(entityId, wrapper)
							}
						} else {
							wrapper.state = EntityState.UPGRADING
							pushEntityToUpgrade(wrapper, entity)
						}
						break
					}
					case EntityState.UPGRADING:
					case EntityState.UPGRADING_INVALIDATED:
						// In progress, ignore
						break
					case EntityState.READY:
						// Already processed, ignore
						break
					case EntityState.PENDING_DELETE: {
						// Plan for deletion
						this.#entities.delete(entityId)

						leaveSubscription(entityId, wrapper)
						break
					}

					default:
						assertNever(wrapper.state)
				}

				// If the payloads are getting large, send them now and reset
				// We do this to avoid sending too much data in one go, which can cause issues with IPC
				// The exact limits here are somewhat arbitrary, but should be sufficient for most use cases
				if (updateActionsPayload.size > MAX_UPDATE_PER_BATCH) {
					this.#queueUpdateActionsBatch(updateActionsPayload)

					// Start a new batch
					updateActionsPayload = new Map()
				}
				if (updateFeedbacksPayload.size > MAX_UPDATE_PER_BATCH) {
					this.#queueUpdateFeedbacksBatch(updateFeedbacksPayload)

					// Start a new batch
					updateFeedbacksPayload = new Map()
				}
			}

			if (joinedFeedbackValues.length > 0) {
				this.controlsStore.updateFeedbackValues(this.#connectionId, joinedFeedbackValues)
			}

			// Start by sending the simple payloads
			if (updateActionsPayload.size > 0) {
				this.#queueUpdateActionsBatch(updateActionsPayload)
			}
			if (updateFeedbacksPayload.size > 0) {
				this.#queueUpdateFeedbacksBatch(updateFeedbacksPayload)
			}

			// Now we need to send the upgrades
			if (actionIdsInThisBatch.size > 0) {
				this.#sendUpgradeActionsBatch(actionIdsInThisBatch, upgradeActions)
			}
			if (feedbackIdsInThisBatch.size > 0) {
				this.#sendUpgradeFeedbacksBatch(feedbackIdsInThisBatch, upgradeFeedbacks)
			}
		},
		{
			before: false,
			after: true,
			maxWait: 50,
			wait: 10,
		}
	)

	/**
	 * Add a batch to the send queue, and start it if there is capacity.
	 * This bounds the number of IPC calls in flight at once, so that the per-call timeouts don't all
	 * start ticking simultaneously when a large number of entities is processed in one go.
	 */
	#queueBatch(fn: () => Promise<void>): void {
		this.#batchQueue.push(fn)
		this.#pumpBatchQueue()
	}
	#pumpBatchQueue(): void {
		while (this.#inflightBatches < MAX_INFLIGHT_BATCHES && this.#batchQueue.length > 0) {
			const fn = this.#batchQueue.shift()!
			this.#inflightBatches++
			void fn().finally(() => {
				this.#inflightBatches--
				this.#pumpBatchQueue()
			})
		}
	}

	#queueUpdateActionsBatch(updateActionsPayload: Map<string, EntityManagerActionEntity | null>): void {
		this.#queueBatch(async () =>
			this.#adapter.updateActions(updateActionsPayload).catch((e) => {
				this.#logger.error('Error sending updateActions', e)
			})
		)
	}
	#queueUpdateFeedbacksBatch(updateFeedbacksPayload: Map<string, EntityManagerFeedbackEntity | null>): void {
		this.#queueBatch(async () =>
			this.#adapter.updateFeedbacks(updateFeedbacksPayload).catch((e) => {
				this.#logger.error('Error sending updateFeedbacks', e)
			})
		)
	}

	#sendUpgradeActionsBatch(
		entityIdsInThisBatch: ReadonlyMap<string, string>,
		upgradeActions: Omit<EntityManagerActionEntity, 'parsedOptions'>[]
	): void {
		this.#queueBatch(async () =>
			this.#adapter
				.upgradeActions(upgradeActions, this.#currentUpgradeIndex)
				.then((upgradedEntities) => {
					this.#upgradeBatchResolve(entityIdsInThisBatch, upgradedEntities)
				})
				.catch((e) => {
					this.#logger.error('Error sending upgradeActions', e)

					this.#upgradeBatchRetry(entityIdsInThisBatch)
				})
		)
	}
	#sendUpgradeFeedbacksBatch(
		entityIdsInThisBatch: ReadonlyMap<string, string>,
		upgradeFeedbacks: Omit<EntityManagerFeedbackEntity, 'parsedOptions'>[]
	): void {
		this.#queueBatch(async () =>
			this.#adapter
				.upgradeFeedbacks(upgradeFeedbacks, this.#currentUpgradeIndex)
				.then((upgradedEntities) => {
					this.#upgradeBatchResolve(entityIdsInThisBatch, upgradedEntities)
				})
				.catch((e) => {
					this.#logger.error('Error sending upgradeFeedbacks', e)

					this.#upgradeBatchRetry(entityIdsInThisBatch)
				})
		)
	}

	#upgradeBatchResolve(
		entityIdsInThisBatch: ReadonlyMap<string, string>,
		rawUpgradedEntities: SomeReplaceableEntityModel[]
	): void {
		if (!this.#ready) return

		// We have the upgraded entities, lets patch the tracked entities
		const upgradedEntities = new Map(rawUpgradedEntities.map((ent) => [ent.id, ent]))

		// Loop through what we sent, as we don't get a response for all of them
		for (const [entityId, wrapperId] of entityIdsInThisBatch) {
			const wrapper = this.#entities.get(entityId)
			// Entity may have been deleted or recreated, if so we can ignore it
			if (!wrapper || wrapper.wrapperId !== wrapperId) continue

			const entity = wrapper.entity.deref()
			if (!entity) {
				this.#logger.warn(`Entity ${wrapper.wrapperId} has been garbage collected, terminating upgrade`)
				this.#entities.delete(entityId)
				continue
			}

			this.#logger.silly(`Processing entity ${entityId} in control ${wrapper.controlId} with state ${wrapper.state}`)

			switch (wrapper.state) {
				case EntityState.UPGRADING_INVALIDATED:
					// It has been invalidated, it needs to be re-run
					wrapper.state = EntityState.UNLOADED
					break
				case EntityState.UPGRADING: {
					// It has been upgraded, so we can update the entity

					// We need to do this via the EntityPool method, so that it gets persisted correctly
					const control = this.controlsStore.getControl(wrapper.controlId)
					if (!control || !control.supportsEntities) {
						this.#logger.warn(`Control ${wrapper.controlId} not found`)
						continue
					}

					const upgradedEntity = upgradedEntities.get(entity.id)
					if (!upgradedEntity) continue

					if (upgradedEntity.type !== entity.type) {
						this.#logger.error(`Upgraded entity ${entity.id} in control ${wrapper.controlId} has mismatched type`)
						continue
					}

					try {
						control.entities.entityReplaceForUpgrade(upgradedEntity)
					} catch (e) {
						// If we fail to replace the entity, we can just ignore it
						this.#logger.error(`Error replacing entity ${entity.id} in control ${wrapper.controlId}`, e)
					}

					break
				}
				case EntityState.READY:
				case EntityState.UNLOADED:
					// Shouldn't happen, lets pretend it didnt
					break
				case EntityState.PENDING_DELETE:
					// About to be deleted, so we can ignore it
					break

				default:
					assertNever(wrapper.state)
					break
			}
		}

		this.#debounceProcessPending()
	}

	#upgradeBatchRetry(entityIdsInThisBatch: ReadonlyMap<string, string>): void {
		// There isn't much we can do to retry the upgrade, the best we can do is pretend it was fine and progress the entities through the process
		for (const [entityId, wrapperId] of entityIdsInThisBatch) {
			const wrapper = this.#entities.get(entityId)
			if (!wrapper || wrapper.wrapperId !== wrapperId) continue
			if (wrapper.state === EntityState.UPGRADING) {
				// Pretend it was fine
				wrapper.state = EntityState.READY
			} else if (wrapper.state === EntityState.UPGRADING_INVALIDATED) {
				// This can be retried
				wrapper.state = EntityState.UNLOADED
			}
		}

		// Make sure anything pending is processed
		this.#debounceProcessPending()
	}

	/**
	 * Start the processing of entities in the manager.
	 * This should be called when the module is ready to start processing entities, and will trigger any queued entities.
	 */
	start(currentUpgradeIndex: number): void {
		this.#ready = true
		this.#currentUpgradeIndex = currentUpgradeIndex

		this.#debounceProcessPending()
	}

	/**
	 * Destroy the entity manager, clearing all entities and aborting any pending processing.
	 * Cleanup is not performed, it is assumed that the module is no longer running.
	 */
	destroy(): void {
		this.#unsubscribeRenderClock()
		this.#debounceProcessPending.cancel()
		this.#batchQueue.length = 0
		this.#entities.clear()
		this.#subscriptions.clear()
		this.#ready = false
	}

	/**
	 * Track an entity in the manager.
	 * This will ensure that the entity is processed and sent to the module for subscription callbacks.
	 * If the entity already exists, it will be replaced and the new entity will be processed as needed.
	 */
	trackEntity(entity: ControlEntityInstance, controlId: string): void {
		// This may replace an existing entity, if so it needs to restart the process.
		// It stays in the subscription of what it replaced until it has been processed
		this.#entities.set(entity.id, {
			wrapperId: nanoid(),
			entity: new WeakRef(entity),
			controlId: controlId,
			state: EntityState.UNLOADED,
			subscriptionId: this.#entities.get(entity.id)?.subscriptionId,
			resendRequested: this.#entities.get(entity.id)?.resendRequested,
		})

		this.#logger.silly(`Queued entity ${entity.id} in control ${controlId} as unloaded`)

		this.#debounceProcessPending()
	}

	/**
	 * Get the id of the module subscription an entity is a member of.
	 * This is the id the module knows the entity by, which can be shared with other identical entities in the same control.
	 * @param entityId The id of the entity
	 * @returns The id of the subscription, or undefined if the entity is not subscribed
	 */
	getSubscriptionId(entityId: string): string | undefined {
		return this.#entities.get(entityId)?.subscriptionId
	}

	/**
	 * Handle feedback values reported by the module, passing each to every entity which shares the subscription
	 * @param values The values for each subscription
	 */
	handleFeedbackValues(values: EntityManagerFeedbackValue[]): void {
		const entityValues: NewFeedbackValue[] = []

		for (const { id, controlId, value } of values) {
			const subscription = this.#subscriptions.get(id)
			// The subscription may have been removed while the value was in flight
			if (!subscription || subscription.controlId !== controlId) continue

			subscription.lastValue = { value }

			for (const entityId of subscription.memberIds) {
				entityValues.push({ entityId, controlId, value })
			}
		}

		if (entityValues.length > 0) this.controlsStore.updateFeedbackValues(this.#connectionId, entityValues)
	}

	/**
	 * Forget an entity in the manager.
	 * This will remove the entity from the manager and abort any pending processing.
	 */
	forgetEntity(entityId: string): void {
		const wrapper = this.#entities.get(entityId)
		if (!wrapper) return

		// mark as pending deletion
		wrapper.state = EntityState.PENDING_DELETE

		this.#logger.silly(`Queued entity ${entityId} in control ${wrapper.controlId} to be unloaded`)

		this.#debounceProcessPending()
	}

	/**
	 * Resend all tracked feedback entities to the module.
	 * This will mark all feedbacks as unloaded, so that they are re-sent to the module.
	 * This is intended to be used when the top-bar setting changes, as the dimensions reported to the module will change.
	 */
	resendFeedbacks(): void {
		for (const entity of this.#entities.values()) {
			if (entity.entity.deref()?.type !== EntityModelType.Feedback) continue

			// The image size is not part of the subscription id, so it must be sent even though it looks unchanged
			entity.resendRequested = true

			switch (entity.state) {
				case EntityState.UNLOADED:
				case EntityState.UPGRADING_INVALIDATED:
					// Nothing to do, already pending
					break
				case EntityState.READY:
					entity.state = EntityState.UNLOADED
					break
				case EntityState.UPGRADING:
					entity.state = EntityState.UPGRADING_INVALIDATED
					break
				case EntityState.PENDING_DELETE:
					// This is about to be deleted, so we can ignore it
					break
				default:
					assertNever(entity.state)
					break
			}
		}

		this.#debounceProcessPending()
	}

	/**
	 * Inform the entity manager that some variables have changed.
	 * This will cause any entities that reference those variables to be re-parsed and sent to the module.
	 */
	onVariablesChanged(variableIds: ReadonlySet<string>, controlIdFilter: ReadonlySet<string> | null): void {
		let anyInvalidated = false

		for (const wrapper of this.#entities.values()) {
			if (
				wrapper.state === EntityState.UNLOADED ||
				wrapper.state === EntityState.UPGRADING_INVALIDATED ||
				wrapper.state === EntityState.UPGRADING ||
				wrapper.state === EntityState.PENDING_DELETE
			) {
				// Nothing to do, the entity is not in the ready state
				continue
			}

			if (controlIdFilter && !controlIdFilter.has(wrapper.controlId)) {
				// The change is scoped to specific control(s), and this entity is not in one of them
				continue
			}

			if (!wrapper.lastReferencedVariableIds || wrapper.lastReferencedVariableIds.size === 0) {
				// No variables to check, nothing to do
				continue
			}

			if (variableIds.isDisjointFrom(wrapper.lastReferencedVariableIds)) {
				// No variables changed that we care about, nothing to do
				continue
			}

			// The entity is ready, so we need to re-parse the options
			wrapper.state = EntityState.UNLOADED
			anyInvalidated = true
		}

		if (anyInvalidated) this.#debounceProcessPending()
	}

	/**
	 * Inform the entity manager that the render clock has ticked.
	 * This will cause any feedback entities whose options depend on the render clock to be re-parsed.
	 */
	onRenderClockTick(): void {
		let anyInvalidated = false

		for (const wrapper of this.#entities.values()) {
			if (wrapper.state !== EntityState.READY) continue
			if (!wrapper.lastClockSensitive) continue
			if (wrapper.entity.deref()?.type !== EntityModelType.Feedback) continue

			wrapper.state = EntityState.UNLOADED
			anyInvalidated = true
		}

		if (anyInvalidated) this.#debounceProcessPending()
	}

	/**
	 * Inform the entity manager that the entity definitions have changed.
	 * This will cause all entities of the given type to be invalidated, so that they can be re-parsed with the new definitions.
	 * Future: it would be better for this to do some diffing or be more granular, but for now this is sufficient.
	 */
	onEntityDefinitionsChanged(entityType: EntityModelType): void {
		let anyInvalidated = false

		// If the definitions change, we need to invalidate all entities of that type
		for (const wrapper of this.#entities.values()) {
			const entity = wrapper.entity.deref()
			if (!entity || entity.type !== entityType) continue

			// Send the subscriptions again even if they are unchanged, so the module sees them against its new definitions
			wrapper.resendRequested = true

			switch (wrapper.state) {
				case EntityState.UNLOADED:
				case EntityState.UPGRADING_INVALIDATED:
					// Nothing to do, already pending
					break
				case EntityState.READY:
					wrapper.state = EntityState.UNLOADED
					anyInvalidated = true
					break
				case EntityState.UPGRADING:
					wrapper.state = EntityState.UPGRADING_INVALIDATED
					anyInvalidated = true
					break
				case EntityState.PENDING_DELETE:
					// This is about to be deleted, so we can ignore it
					break
				default:
					assertNever(wrapper.state)
					break
			}
		}

		if (anyInvalidated) this.#debounceProcessPending()
	}
}
