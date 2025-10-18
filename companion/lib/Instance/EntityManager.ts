import debounceFn from 'debounce-fn'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type {
	FeedbackInstance as ModuleFeedbackInstance,
	HostToModuleEventsV0,
	ModuleToHostEventsV0,
	UpdateActionInstancesMessage,
	UpdateFeedbackInstancesMessage,
	UpgradeActionAndFeedbackInstancesMessage,
} from '@companion-module/base/dist/host-api/api.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { IpcWrapper } from '@companion-module/base/dist/host-api/ipc-wrapper.js'
import { nanoid } from 'nanoid'
import type { ControlsController } from '../Controls/Controller.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { OptionsObject } from '@companion-module/base/dist/util.js'
import LogController, { Logger } from '../Log/Controller.js'

const MAX_UPDATE_PER_BATCH = 50 // Arbitrary limit to avoid sending too much data in one go

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
	lastReferencedVariableIds?: ReadonlySet<string>
}

/**
 * This class is responsible for managing the entities that are tracked by the module
 * With this, it will ensure that the entities are run through the upgrade scripts as needed, and also
 * have the options parsed (by as much as companion supports) before being sent to the module for subscription callbacks
 */
export class InstanceEntityManager {
	readonly #logger: Logger

	readonly #ipcWrapper: IpcWrapper<HostToModuleEventsV0, ModuleToHostEventsV0>
	readonly #controlsController: ControlsController

	readonly #entities = new Map<string, EntityWrapper>()

	// Before the connection is ready, we need to not send any updates
	#ready = false
	#currentUpgradeIndex = 0

	constructor(
		ipcWrapper: IpcWrapper<HostToModuleEventsV0, ModuleToHostEventsV0>,
		controlsController: ControlsController,
		connectionId: string
	) {
		this.#logger = LogController.createLogger(`Instance/EntityManager/${connectionId}`)
		this.#ipcWrapper = ipcWrapper
		this.#controlsController = controlsController
	}

	readonly #debounceProcessPending = debounceFn(
		() => {
			if (!this.#ready) return

			let entityIdsInThisBatch = new Map<string, string>()
			let upgradePayload: UpgradeActionAndFeedbackInstancesMessage = {
				actions: [],
				feedbacks: [],
				defaultUpgradeIndex: 0, // TODO - remove this!
			}
			let updateActionsPayload: UpdateActionInstancesMessage = {
				actions: {},
			}
			let updateFeedbacksPayload: UpdateFeedbackInstancesMessage = {
				feedbacks: {},
			}

			const pushEntityToUpgrade = (wrapper: EntityWrapper, entity: ControlEntityInstance) => {
				this.#logger.silly(
					`Pushing entity ${entity.id} in control ${wrapper.controlId} for upgrade from ${entity.upgradeIndex} to ${this.#currentUpgradeIndex}`
				)

				entityIdsInThisBatch.set(entity.id, wrapper.wrapperId)
				const entityModel = entity.asEntityModel(false)
				switch (entityModel.type) {
					case EntityModelType.Action:
						upgradePayload.actions.push({
							id: entityModel.id,
							controlId: wrapper.controlId,
							actionId: entityModel.definitionId,
							options: entityModel.options,

							upgradeIndex: entityModel.upgradeIndex ?? null,
							disabled: !!entityModel.disabled,
						})
						break
					case EntityModelType.Feedback:
						upgradePayload.feedbacks.push({
							id: entityModel.id,
							controlId: wrapper.controlId,
							feedbackId: entityModel.definitionId,
							options: entityModel.options,

							isInverted: !!entityModel.isInverted,

							upgradeIndex: entityModel.upgradeIndex ?? null,
							disabled: !!entityModel.disabled,
						})
						break
					default:
						assertNever(entityModel)
						this.#logger.warn('Unknown entity type', entity.type)
				}

				// If the payloads are getting large, send them now and reset
				// We do this to avoid sending too much data in one go, which can cause issues with IPC
				// The exact limits here are somewhat arbitrary, but should be sufficient for most use cases
				if (entityIdsInThisBatch.size > MAX_UPDATE_PER_BATCH) {
					this.#sendUpgradeBatch(entityIdsInThisBatch, upgradePayload)

					// Start a new batch
					entityIdsInThisBatch = new Map()
					upgradePayload = {
						actions: [],
						feedbacks: [],
						defaultUpgradeIndex: 0, // TODO - remove this!
					}
				}
			}

			const controlImageSizeCache = new Map<string, ModuleFeedbackInstance['image']>()

			// First, look over all the entiites and figure out what needs to be done to each
			for (const [entityId, wrapper] of this.#entities) {
				switch (wrapper.state) {
					case EntityState.UNLOADED: {
						const entity = wrapper.entity.deref()
						if (!entity) {
							this.#logger.warn(`Entity ${wrapper.wrapperId} has been garbage collected, skipping upgrade`)
							this.#entities.delete(entityId)
							continue
						}

						// The entity is unloaded, it either needs to be upgraded or loaded
						if (entity.upgradeIndex === undefined || entity.upgradeIndex === this.#currentUpgradeIndex) {
							wrapper.state = EntityState.READY

							const entityDefinition = entity.getEntityDefinition()
							if (!entityDefinition || !entityDefinition.hasLifecycleFunctions) {
								// The entity does not have lifecycle functions, so we can skip informing the module about it
								continue
							}

							const entityModel = entity.asEntityModel(false)

							// Parse the options and track the variables referenced
							const { parsedOptions, referencedVariableIds } = this.parseOptionsObject(
								entityDefinition,
								entityModel.options,
								wrapper.controlId
							)
							wrapper.lastReferencedVariableIds = referencedVariableIds

							switch (entityModel.type) {
								case EntityModelType.Action:
									updateActionsPayload.actions[entityId] = {
										id: entityModel.id,
										controlId: wrapper.controlId,
										actionId: entityModel.definitionId,
										options: parsedOptions,

										upgradeIndex: entityModel.upgradeIndex ?? null,
										disabled: !!entityModel.disabled,
									}
									break
								case EntityModelType.Feedback: {
									let imageSize: ModuleFeedbackInstance['image'] | undefined
									if (controlImageSizeCache.has(wrapper.controlId)) {
										imageSize = controlImageSizeCache.get(wrapper.controlId)
									} else {
										const control = this.#controlsController.getControl(wrapper.controlId)
										imageSize = control?.getBitmapSize() ?? undefined
										controlImageSizeCache.set(wrapper.controlId, imageSize)
									}

									updateFeedbacksPayload.feedbacks[entityId] = {
										id: entityModel.id,
										controlId: wrapper.controlId,
										feedbackId: entityModel.definitionId,
										options: parsedOptions,

										image: imageSize,

										isInverted: !!entityModel.isInverted,

										upgradeIndex: entityModel.upgradeIndex ?? null,
										disabled: !!entityModel.disabled,
									}
									break
								}
								default:
									assertNever(entityModel)
									this.#logger.warn('Unknown entity type', entity.type)
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

						const entity = wrapper.entity.deref()

						if (entity) {
							switch (entity.type) {
								case EntityModelType.Action:
									updateActionsPayload.actions[entityId] = null
									break
								case EntityModelType.Feedback:
									updateFeedbacksPayload.feedbacks[entityId] = null
									break
								default:
									assertNever(entity.type)
									this.#logger.warn('Unknown entity type', entity.type)
							}
						}
						break
					}

					default:
						assertNever(wrapper.state)
				}

				// If the payloads are getting large, send them now and reset
				// We do this to avoid sending too much data in one go, which can cause issues with IPC
				// The exact limits here are somewhat arbitrary, but should be sufficient for most use cases
				if (Object.keys(updateActionsPayload.actions).length > MAX_UPDATE_PER_BATCH) {
					this.#ipcWrapper.sendWithCb('updateActions', updateActionsPayload).catch((e) => {
						this.#logger.error('Error sending updateActions', e)
					})

					// Start a new batch
					updateActionsPayload = { actions: {} }
				}
				if (Object.keys(updateFeedbacksPayload.feedbacks).length > MAX_UPDATE_PER_BATCH) {
					this.#ipcWrapper.sendWithCb('updateFeedbacks', updateFeedbacksPayload).catch((e) => {
						this.#logger.error('Error sending updateFeedbacks', e)
					})

					// Start a new batch
					updateFeedbacksPayload = { feedbacks: {} }
				}
			}

			// Start by sending the simple payloads
			if (Object.keys(updateActionsPayload.actions).length > 0) {
				this.#ipcWrapper.sendWithCb('updateActions', updateActionsPayload).catch((e) => {
					this.#logger.error('Error sending updateActions', e)
				})
			}
			if (Object.keys(updateFeedbacksPayload.feedbacks).length > 0) {
				this.#ipcWrapper.sendWithCb('updateFeedbacks', updateFeedbacksPayload).catch((e) => {
					this.#logger.error('Error sending updateFeedbacks', e)
				})
			}

			// Now we need to send the upgrades
			if (entityIdsInThisBatch.size > 0) {
				this.#sendUpgradeBatch(entityIdsInThisBatch, upgradePayload)
			}
		},
		{
			before: false,
			after: true,
			maxWait: 50,
			wait: 10,
		}
	)

	#sendUpgradeBatch(
		entityIdsInThisBatch: ReadonlyMap<string, string>,
		upgradePayload: UpgradeActionAndFeedbackInstancesMessage
	): void {
		this.#ipcWrapper
			.sendWithCb('upgradeActionsAndFeedbacks', upgradePayload)
			.then((upgraded) => {
				if (!this.#ready) return

				// We have the upgraded entities, lets patch the tracked entities

				const upgradedActions = new Map(upgraded.updatedActions.map((act) => [act.id, act]))
				const upgradedFeedbacks = new Map(upgraded.updatedFeedbacks.map((fb) => [fb.id, fb]))

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

					this.#logger.silly(
						`Processing entity ${entityId} in control ${wrapper.controlId} with state ${wrapper.state}`
					)

					switch (wrapper.state) {
						case EntityState.UPGRADING_INVALIDATED:
							// It has been invalidated, it needs to be re-run
							wrapper.state = EntityState.UNLOADED
							break
						case EntityState.UPGRADING: {
							// It has been upgraded, so we can update the entity

							// We need to do this via the EntityPool method, so that it gets persisted correctly
							const control = this.#controlsController.getControl(wrapper.controlId)
							if (!control || !control.supportsEntities) {
								this.#logger.warn(`Control ${wrapper.controlId} not found`)
								continue
							}

							try {
								switch (entity.type) {
									case EntityModelType.Action: {
										const action = upgradedActions.get(entity.id)
										if (action) {
											control.entities.entityReplace({
												id: action.id,
												type: EntityModelType.Action,
												definitionId: action.actionId,
												options: action.options,
												upgradeIndex: this.#currentUpgradeIndex,
											})
										}
										break
									}
									case EntityModelType.Feedback: {
										const feedback = upgradedFeedbacks.get(entity.id)
										if (feedback) {
											control.entities.entityReplace({
												id: feedback.id,
												type: EntityModelType.Feedback,
												definitionId: feedback.feedbackId,
												options: feedback.options,
												style: feedback.style,
												isInverted: feedback.isInverted,
												upgradeIndex: this.#currentUpgradeIndex,
											})
										}
										break
									}
									default:
										assertNever(entity.type)
										break
								}
							} catch (e) {
								this.#logger.error(`Error replacing entity ${entity.id} in control ${wrapper.controlId}`, e)
								// If we fail to replace the entity, we can just ignore it
								continue
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
			})
			.catch((e) => {
				this.#logger.error('Error sending upgradeActionsAndFeedbacks', e)

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
			})
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
		this.#entities.clear()
		this.#ready = false
	}

	/**
	 * Track an entity in the manager.
	 * This will ensure that the entity is processed and sent to the module for subscription callbacks.
	 * If the entity already exists, it will be replaced and the new entity will be processed as needed.
	 */
	trackEntity(entity: ControlEntityInstance, controlId: string): void {
		// This may replace an existing entity, if so it needs to restart the process
		this.#entities.set(entity.id, {
			wrapperId: nanoid(),
			entity: new WeakRef(entity),
			controlId: controlId,
			state: EntityState.UNLOADED,
		})

		this.#logger.silly(`Queued entity ${entity.id} in control ${controlId} as unloaded`)

		this.#debounceProcessPending()
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
	 * Parse any variables in the options object for an entity.
	 * Note: this will drop any options that are not defined in the entity definition.
	 */
	parseOptionsObject(
		entityDefinition: ClientEntityDefinition | undefined,
		options: OptionsObject,
		controlId: string
	): {
		parsedOptions: OptionsObject
		referencedVariableIds: Set<string>
	} {
		if (!entityDefinition)
			// If we don't know what fields need parsing, we can't do anything
			return { parsedOptions: options, referencedVariableIds: new Set() }

		const parsedOptions: OptionsObject = {}
		const referencedVariableIds = new Set<string>()

		const parser = this.#controlsController.createVariablesAndExpressionParser(controlId, null)

		for (const field of entityDefinition.options) {
			if (field.type !== 'textinput' || !field.useVariables) {
				// Field doesn't support variables, pass unchanged
				parsedOptions[field.id] = options[field.id]
				continue
			}

			// Field needs parsing
			// Note - we don't need to care about the granularity given in `useVariables`,
			const parseResult = parser.parseVariables(String(options[field.id]))
			parsedOptions[field.id] = parseResult.text

			// Track the variables referenced in this field
			if (!entityDefinition.optionsToIgnoreForSubscribe.includes(field.id)) {
				for (const variable of parseResult.variableIds) {
					referencedVariableIds.add(variable)
				}
			}
		}

		return { parsedOptions, referencedVariableIds }
	}

	/**
	 * Inform the entity manager that some variables have changed.
	 * This will cause any entities that reference those variables to be re-parsed and sent to the module.
	 */
	onVariablesChanged(variableIds: Set<string>): void {
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
