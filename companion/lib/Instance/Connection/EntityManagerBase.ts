import debounceFn from 'debounce-fn'
import { nanoid } from 'nanoid'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type {
	ActionEntityModel,
	FeedbackEntityModel,
	ReplaceableActionEntityModel,
	ReplaceableFeedbackEntityModel,
	SomeEntityModel,
	SomeReplaceableEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { createStableObjectHash } from '@companion-app/shared/Util/Hash.js'
import type { CompanionOptionValues } from '@companion-module/base'
import type { ControlEntityInstance } from '../../Controls/Entities/EntityInstance.js'
import type { IControlStore } from '../../Controls/IControlStore.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import type {
	VariableDependency,
	VariableDependencyListener,
	VariableDependencyRegistry,
} from '../../Variables/DependencyRegistry.js'

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

export interface EntityWrapper {
	/** A unique id for this wrapper, so that we know if the entity was replaced/deleted */
	readonly wrapperId: string
	readonly entity: WeakRef<ControlEntityInstance>
	readonly controlId: SomeControlId

	state: EntityState
	/** The id of the subscription this entity is a member of, if it is subscribed to the module */
	subscriptionId?: string
	/**
	 * Whether the subscription must be sent to the module again even if it is unchanged, as something which isn't
	 * part of its key has changed (eg the image size of a feedback)
	 */
	resendRequested?: boolean
	/** Whether this replaced another instance of the entity, so has none of the values that one was given */
	isNewInstance?: boolean
	/** The variables referenced by the last parse of the options, created when it first references any */
	variables: VariableDependency<EntityWrapper> | null
}

/**
 * A subscription sent to the module. Entities in the same control which parse to the same options share a
 * subscription, so the module only sees it once. Its id is random, so that when its options change it can be
 * updated in place, letting the module see the change rather than a new subscription.
 */
export interface EntitySubscription {
	readonly controlId: SomeControlId
	/** What makes this subscription unique, from `getEntitySubscriptionKey` */
	key: string
	/** The ids of the entities which share this subscription */
	readonly memberIds: Set<string>
}

/** Entities which have joined a subscription the module already knows about, so have missed what it reported */
export interface EntitySubscriptionJoin {
	readonly subscriptionId: string
	readonly entityIds: readonly string[]
}

export interface EntityManagerEntity<TModel extends SomeEntityModel> {
	controlId: SomeControlId
	entity: TModel
	parsedOptions: CompanionOptionValues
}
export type EntityManagerActionEntity = EntityManagerEntity<ActionEntityModel>
export type EntityManagerFeedbackEntity = EntityManagerEntity<FeedbackEntityModel>
export type EntityManagerUpgradeEntity<TModel extends SomeEntityModel> = Omit<
	EntityManagerEntity<TModel>,
	'parsedOptions'
>

export interface EntityManagerAdapter {
	/** Send changes to the subscriptions, keyed by the id of each subscription. `null` deletes a subscription */
	updateActions: (actions: Map<string, EntityManagerActionEntity | null>) => Promise<void>
	updateFeedbacks: (feedbacks: Map<string, EntityManagerFeedbackEntity | null>) => Promise<void>

	upgradeActions: (
		actions: EntityManagerUpgradeEntity<ActionEntityModel>[],
		currentUpgradeIndex: number
	) => Promise<ReplaceableActionEntityModel[]>

	upgradeFeedbacks: (
		feedbacks: EntityManagerUpgradeEntity<FeedbackEntityModel>[],
		currentUpgradeIndex: number
	) => Promise<ReplaceableFeedbackEntityModel[]>
}

/**
 * Get the key of the module subscription for an entity, from what makes the subscription unique
 * @param controlId The control the entity belongs to
 * @param entityModel The entity
 * @param parsedOptions The options of the entity, as parsed for the module
 */
function getEntitySubscriptionKey(
	controlId: SomeControlId,
	entityModel: SomeEntityModel,
	parsedOptions: CompanionOptionValues
): string {
	// Inversion is not part of it, as Companion applies that to the value of each entity
	return JSON.stringify([controlId, entityModel.definitionId, createStableObjectHash(parsedOptions)])
}

/**
 * Split a payload into batches of at most MAX_UPDATE_PER_BATCH entries
 */
function splitIntoBatches<T>(payload: ReadonlyMap<string, T>): Map<string, T>[] {
	const batches: Map<string, T>[] = []
	for (const entry of payload) {
		let batch = batches.at(-1)
		if (!batch || batch.size >= MAX_UPDATE_PER_BATCH) {
			batch = new Map()
			batches.push(batch)
		}
		batch.set(entry[0], entry[1])
	}
	return batches
}

/** An entity whose options no longer match its subscription, waiting to be placed in one */
interface MovingEntity<TModel extends SomeEntityModel> {
	readonly entityId: string
	readonly wrapper: EntityWrapper
	readonly key: string
	readonly payload: EntityManagerEntity<TModel>
	/** The subscription the entity has left, if any */
	readonly fromSubscriptionId: string | undefined
}

/**
 * Manages the entities of one type that are tracked by a module.
 * It ensures that the entities are run through the upgrade scripts as needed, and also have the options parsed
 * (by as much as companion supports) before being sent to the module for subscription callbacks.
 * Each type of entity extends it with what is particular to that type.
 */
export abstract class EntityManagerBase<
	TModel extends SomeEntityModel,
> implements VariableDependencyListener<EntityWrapper> {
	protected readonly logger: Logger

	readonly entityType: TModel['type']
	readonly controlsStore: IControlStore
	protected readonly connectionId: string

	readonly #entities = new Map<string, EntityWrapper>()
	readonly #variableDependencies: VariableDependencyRegistry
	readonly #subscriptions = new Map<string, EntitySubscription>()
	/** The id of the subscription for each key */
	readonly #subscriptionIdsByKey = new Map<string, string>()

	// Before the connection is ready, we need to not send any updates
	#ready = false
	#currentUpgradeIndex = 0

	// Queue of update/upgrade batches waiting to be sent, and the number currently in flight.
	// This bounds how many IPC calls are outstanding at once, see MAX_INFLIGHT_BATCHES.
	readonly #batchQueue: Array<() => Promise<void>> = []
	#inflightBatches = 0

	constructor(
		entityType: TModel['type'],
		controlsStore: IControlStore,
		connectionId: string,
		variableDependencies: VariableDependencyRegistry
	) {
		this.logger = LogController.createLogger(`Instance/Connection/EntityManager/${connectionId}/${entityType}`)
		this.entityType = entityType
		this.connectionId = connectionId
		this.controlsStore = controlsStore
		this.#variableDependencies = variableDependencies
	}

	/** Send changes to the subscriptions, keyed by the id of each subscription. `null` deletes a subscription */
	protected abstract sendUpdates(payload: Map<string, EntityManagerEntity<TModel> | null>): Promise<void>

	/** Send entities to the module to be upgraded */
	protected abstract sendUpgrades(
		entities: EntityManagerUpgradeEntity<TModel>[],
		currentUpgradeIndex: number
	): Promise<SomeReplaceableEntityModel[]>

	/** The options of an entity have been parsed */
	protected abstract onOptionsParsed(wrapper: EntityWrapper, clockSensitive: boolean): void

	/** Entities have joined subscriptions the module already knows about, in a run of processing */
	protected abstract onSubscriptionsJoined(joins: EntitySubscriptionJoin[]): void

	/** A subscription is being given new options or deleted, so what the module reported for it no longer applies */
	protected abstract onSubscriptionReset(subscriptionId: string): void

	readonly #debounceProcessPending = debounceFn(
		() => {
			if (!this.#ready) return

			let entityIdsInThisBatch = new Map<string, string>()
			let upgradeEntities: EntityManagerUpgradeEntity<TModel>[] = []

			const updatePayload = new Map<string, EntityManagerEntity<TModel> | null>()

			// Entities which have joined subscriptions the module already knows about
			const joins: EntitySubscriptionJoin[] = []

			// Subscriptions left empty by this run. Deleted at the end, unless reused for an entity whose options changed
			const vacatedSubscriptionIds = new Set<string>()
			// Placed once every entity has been processed, so that all those leaving a subscription are known
			const movingEntities: MovingEntity<TModel>[] = []

			/** Remove an entity from its subscription */
			const leaveSubscription = (entityId: string, wrapper: EntityWrapper) => {
				const subscriptionId = wrapper.subscriptionId
				if (subscriptionId === undefined) return
				wrapper.subscriptionId = undefined

				const subscription = this.#subscriptions.get(subscriptionId)
				if (!subscription) return

				subscription.memberIds.delete(entityId)
				if (subscription.memberIds.size === 0) vacatedSubscriptionIds.add(subscriptionId)
			}

			/** Keep an entity in its subscription if its parsed options still match, otherwise queue it to move */
			const subscribeEntity = (
				entityId: string,
				wrapper: EntityWrapper,
				payload: EntityManagerEntity<TModel>,
				resendRequested: boolean
			) => {
				const key = getEntitySubscriptionKey(wrapper.controlId, payload.entity, payload.parsedOptions)

				const isNewInstance = !!wrapper.isNewInstance
				wrapper.isNewInstance = false

				const subscriptionId = wrapper.subscriptionId
				const subscription = subscriptionId !== undefined ? this.#subscriptions.get(subscriptionId) : undefined
				if (subscriptionId !== undefined && subscription?.key === key) {
					// Unchanged. The key covers everything the module is sent, so it only needs sending again if asked for
					if (resendRequested) updatePayload.set(subscriptionId, payload)

					// The module won't report again until something changes, so a new instance has missed what it reported
					if (isNewInstance) joins.push({ subscriptionId, entityIds: [entityId] })
					return
				}

				leaveSubscription(entityId, wrapper)
				movingEntities.push({ entityId, wrapper, key, payload, fromSubscriptionId: subscriptionId })
			}

			const addSubscriptionMembers = (subscriptionId: string, members: MovingEntity<TModel>[]) => {
				const subscription = this.#subscriptions.get(subscriptionId)!
				for (const member of members) {
					subscription.memberIds.add(member.entityId)
					member.wrapper.subscriptionId = subscriptionId
				}
			}

			/** Place the entities whose options have changed in the subscription for their new options */
			const placeMovingEntities = () => {
				const membersByKey = Map.groupBy(movingEntities, (member) => member.key)

				// Join the existing subscriptions first, so that a vacated subscription isn't reused for options which already have one
				const keysWithoutSubscription: string[] = []
				for (const [key, members] of membersByKey) {
					const subscriptionId = this.#subscriptionIdsByKey.get(key)
					if (subscriptionId === undefined) {
						keysWithoutSubscription.push(key)
						continue
					}

					addSubscriptionMembers(subscriptionId, members)
					vacatedSubscriptionIds.delete(subscriptionId)

					// The module already knows about this subscription, so the entities have missed what it reported
					joins.push({ subscriptionId, entityIds: members.map((member) => member.entityId) })
				}

				for (const key of keysWithoutSubscription) {
					const members = membersByKey.get(key)!
					const payload = members[0].payload

					// Reuse a subscription these entities have emptied, so the module sees its options change.
					// Not one from another control, as a subscription keeps the control it was made for
					const reusedId = members.find(
						(member) =>
							member.fromSubscriptionId !== undefined &&
							vacatedSubscriptionIds.has(member.fromSubscriptionId) &&
							this.#subscriptions.get(member.fromSubscriptionId)?.controlId === payload.controlId
					)?.fromSubscriptionId
					if (reusedId !== undefined) {
						vacatedSubscriptionIds.delete(reusedId)

						const subscription = this.#subscriptions.get(reusedId)!
						if (this.#subscriptionIdsByKey.get(subscription.key) === reusedId) {
							this.#subscriptionIdsByKey.delete(subscription.key)
						}
						subscription.key = key
						this.onSubscriptionReset(reusedId)
						this.#subscriptionIdsByKey.set(key, reusedId)

						addSubscriptionMembers(reusedId, members)
						updatePayload.set(reusedId, payload)
					} else {
						const subscriptionId = nanoid()
						this.#subscriptions.set(subscriptionId, {
							controlId: payload.controlId,
							key,
							memberIds: new Set(),
						})
						this.#subscriptionIdsByKey.set(key, subscriptionId)

						addSubscriptionMembers(subscriptionId, members)
						updatePayload.set(subscriptionId, payload)
					}
				}

				for (const subscriptionId of vacatedSubscriptionIds) {
					const subscription = this.#subscriptions.get(subscriptionId)
					if (!subscription || subscription.memberIds.size > 0) continue

					this.#subscriptions.delete(subscriptionId)
					if (this.#subscriptionIdsByKey.get(subscription.key) === subscriptionId) {
						this.#subscriptionIdsByKey.delete(subscription.key)
					}
					this.onSubscriptionReset(subscriptionId)
					updatePayload.set(subscriptionId, null)
				}
			}

			const pushEntityToUpgrade = (wrapper: EntityWrapper, entity: ControlEntityInstance) => {
				this.logger.silly(
					`Pushing entity ${entity.id} in control ${wrapper.controlId} for upgrade from ${entity.upgradeIndex} to ${this.#currentUpgradeIndex}`
				)

				const entityModel = this.#getOwnModel(entity)
				if (!entityModel) return

				entityIdsInThisBatch.set(entity.id, wrapper.wrapperId)
				upgradeEntities.push({
					controlId: wrapper.controlId,
					entity: entityModel,
				})

				// If the payloads are getting large, send them now and reset
				// We do this to avoid sending too much data in one go, which can cause issues with IPC
				// The exact limits here are somewhat arbitrary, but should be sufficient for most use cases
				if (entityIdsInThisBatch.size > MAX_UPDATE_PER_BATCH) {
					this.#sendUpgradeBatch(entityIdsInThisBatch, upgradeEntities)

					// Start a new batch
					entityIdsInThisBatch = new Map()
					upgradeEntities = []
				}
			}

			// First, look over all the entiites and figure out what needs to be done to each
			for (const [entityId, wrapper] of this.#entities) {
				switch (wrapper.state) {
					case EntityState.UNLOADED: {
						const entity = wrapper.entity.deref()
						if (!entity) {
							this.logger.warn(`Entity ${wrapper.wrapperId} has been garbage collected, skipping upgrade`)
							this.#deleteEntity(entityId)
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

							const entityModel = this.#getOwnModel(entity)
							if (!entityModel) {
								leaveSubscription(entityId, wrapper)
								continue
							}

							let updateOptions: CompanionOptionValues | undefined
							try {
								// Parse the options and track the variables referenced
								const parser = this.controlsStore.createVariablesAndExpressionParser(wrapper.controlId, null)
								const parseRes = parser.parseEntityOptions(entityDefinition, entityModel.options, wrapper.controlId)
								if (!parseRes.ok) {
									this.logger.warn(
										`Failed to parse options for entity ${entity.id} in control ${wrapper.controlId}: ${JSON.stringify(parseRes.optionErrors)}`
									)
								} else {
									updateOptions = parseRes.parsedOptions
								}
								if (!wrapper.variables && parseRes.referencedVariableIds.size > 0) {
									wrapper.variables = this.#variableDependencies.create(this, wrapper.controlId, wrapper)
								}
								wrapper.variables?.set(parseRes.referencedVariableIds)
								this.onOptionsParsed(wrapper, !!parseRes.clockSensitive)
							} catch (e) {
								this.logger.warn(
									`Error parsing options for entity ${entity.id} in control ${wrapper.controlId}, marking as inactive: ${stringifyError(e, false)}`
								)
							}

							if (updateOptions) {
								subscribeEntity(
									entityId,
									wrapper,
									{
										controlId: wrapper.controlId,
										entity: entityModel,
										parsedOptions: updateOptions,
									},
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
						this.#deleteEntity(entityId)

						leaveSubscription(entityId, wrapper)
						break
					}

					default:
						assertNever(wrapper.state)
				}
			}

			placeMovingEntities()

			if (joins.length > 0) this.onSubscriptionsJoined(joins)

			// Start by sending the simple payloads, split up to avoid sending too much data in one go, which can cause issues with IPC
			// The exact limits here are somewhat arbitrary, but should be sufficient for most use cases
			for (const batch of splitIntoBatches(updatePayload)) {
				this.#queueUpdateBatch(batch)
			}

			// Now we need to send the upgrades
			if (entityIdsInThisBatch.size > 0) {
				this.#sendUpgradeBatch(entityIdsInThisBatch, upgradeEntities)
			}
		},
		{
			before: false,
			after: true,
			maxWait: 50,
			wait: 10,
		}
	)

	/** The model of an entity, if it is of the type this manages */
	#getOwnModel(entity: ControlEntityInstance): TModel | undefined {
		const entityModel = entity.asEntityModel(false)
		if (entityModel.type !== this.entityType) {
			this.logger.error(`Entity ${entity.id} is a ${entityModel.type}, not a ${this.entityType}`)
			return undefined
		}
		return entityModel as TModel
	}

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

	#queueUpdateBatch(updatePayload: Map<string, EntityManagerEntity<TModel> | null>): void {
		this.#queueBatch(async () =>
			this.sendUpdates(updatePayload).catch((e: unknown) => {
				this.logger.error(`Error sending ${this.entityType} updates`, e)
			})
		)
	}

	#sendUpgradeBatch(
		entityIdsInThisBatch: ReadonlyMap<string, string>,
		upgradeEntities: EntityManagerUpgradeEntity<TModel>[]
	): void {
		this.#queueBatch(async () =>
			this.sendUpgrades(upgradeEntities, this.#currentUpgradeIndex)
				.then((upgradedEntities) => {
					this.#upgradeBatchResolve(entityIdsInThisBatch, upgradedEntities)
				})
				.catch((e: unknown) => {
					this.logger.error(`Error sending ${this.entityType} upgrades`, e)

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
				this.logger.warn(`Entity ${wrapper.wrapperId} has been garbage collected, terminating upgrade`)
				this.#deleteEntity(entityId)
				continue
			}

			this.logger.silly(`Processing entity ${entityId} in control ${wrapper.controlId} with state ${wrapper.state}`)

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
						this.logger.warn(`Control ${wrapper.controlId} not found`)
						continue
					}

					const upgradedEntity = upgradedEntities.get(entity.id)
					if (!upgradedEntity) continue

					if (upgradedEntity.type !== entity.type) {
						this.logger.error(`Upgraded entity ${entity.id} in control ${wrapper.controlId} has mismatched type`)
						continue
					}

					try {
						control.entities.entityReplaceForUpgrade(upgradedEntity)
					} catch (e) {
						// If we fail to replace the entity, we can just ignore it
						this.logger.error(`Error replacing entity ${entity.id} in control ${wrapper.controlId}`, e)
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
		this.#debounceProcessPending.cancel()
		this.#batchQueue.length = 0
		for (const wrapper of this.#entities.values()) {
			wrapper.variables?.dispose()
		}
		this.#entities.clear()
		for (const subscriptionId of this.#subscriptions.keys()) {
			this.onSubscriptionReset(subscriptionId)
		}
		this.#subscriptions.clear()
		this.#subscriptionIdsByKey.clear()
		this.#ready = false
	}

	/**
	 * Track an entity in the manager.
	 * This will ensure that the entity is processed and sent to the module for subscription callbacks.
	 * If the entity already exists, it will be replaced and the new entity will be processed as needed.
	 */
	trackEntity(entity: ControlEntityInstance, controlId: SomeControlId): void {
		// This may replace an existing entity, if so it needs to restart the process.
		// It stays in the subscription of what it replaced until it has been processed
		const existing = this.#entities.get(entity.id)
		existing?.variables?.dispose()
		this.#entities.set(entity.id, {
			wrapperId: nanoid(),
			entity: new WeakRef(entity),
			controlId: controlId,
			state: EntityState.UNLOADED,
			variables: null,
			subscriptionId: existing?.subscriptionId,
			resendRequested: existing?.resendRequested,
			isNewInstance: !!existing && (existing.isNewInstance || existing.entity.deref() !== entity),
		})

		this.logger.silly(`Queued entity ${entity.id} in control ${controlId} as unloaded`)

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

	/** Get a subscription, for reporting what the module said about it to its members */
	protected getSubscription(subscriptionId: string): EntitySubscription | undefined {
		return this.#subscriptions.get(subscriptionId)
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

		this.logger.silly(`Queued entity ${entityId} in control ${wrapper.controlId} to be unloaded`)

		this.#debounceProcessPending()
	}

	/**
	 * Some variables referenced by tracked entities have changed.
	 * This will cause those entities to be re-parsed and sent to the module.
	 */
	onVariableDependenciesChanged(
		hits: ReadonlyArray<VariableDependency<EntityWrapper>>,
		changed: ReadonlySet<string>
	): void {
		let anyInvalidated = false

		for (const { data: wrapper, variableIds } of hits) {
			if (wrapper.state !== EntityState.READY) {
				// Nothing to do, the entity is not in the ready state
				continue
			}

			if (!variableIds || variableIds.isDisjointFrom(changed)) {
				// No variables changed that we care about, nothing to do
				continue
			}

			// The entity is ready, so we need to re-parse the options
			wrapper.state = EntityState.UNLOADED
			anyInvalidated = true
		}

		if (anyInvalidated) this.#debounceProcessPending()
	}

	#deleteEntity(entityId: string): void {
		this.#entities.get(entityId)?.variables?.dispose()
		this.#entities.delete(entityId)
	}

	/**
	 * Re-parse the ready entities matching a predicate, sending them to the module only if they have changed
	 * @param predicate Whether an entity needs re-parsing
	 */
	protected reparseReadyEntities(predicate: (wrapper: EntityWrapper) => boolean): void {
		let anyInvalidated = false

		for (const wrapper of this.#entities.values()) {
			if (wrapper.state !== EntityState.READY) continue
			if (!predicate(wrapper)) continue

			wrapper.state = EntityState.UNLOADED
			anyInvalidated = true
		}

		if (anyInvalidated) this.#debounceProcessPending()
	}

	/**
	 * Re-process every entity, sending each subscription to the module again even if it is unchanged
	 * @returns Whether any entity was invalidated
	 */
	protected resendAllEntities(): boolean {
		let anyInvalidated = false

		for (const wrapper of this.#entities.values()) {
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

		return anyInvalidated
	}

	/** Process anything pending, on the usual debounce */
	protected processPending(): void {
		this.#debounceProcessPending()
	}

	/**
	 * Inform the entity manager that the entity definitions have changed.
	 * This will cause all entities to be invalidated, so that they can be re-parsed with the new definitions.
	 * Future: it would be better for this to do some diffing or be more granular, but for now this is sufficient.
	 */
	onEntityDefinitionsChanged(): void {
		// Send the subscriptions again even if they are unchanged, so the module sees them against its new definitions
		if (this.resendAllEntities()) this.#debounceProcessPending()
	}
}
