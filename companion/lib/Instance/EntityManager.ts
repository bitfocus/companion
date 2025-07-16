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
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import LogController, { Logger } from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'

enum EntityState {
	UNLOADED = 'UNLOADED',
	UPGRADING = 'UPGRADING',
	UPGRADING_INVALIDATED = 'UPGRADING_INVALIDATED',
	READY = 'READY',
	PENDING_DELETE = 'PENDING_DELETE',
}

interface EntityWrapper {
	/** A unqiue id for this wrapper, so that we know if the entity was replaced/deleted */
	readonly wrapperId: string
	readonly entity: ControlEntityInstance // TODO - should this be a weak ref?
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
	readonly #pageStore: IPageStore

	readonly #entities = new Map<string, EntityWrapper>()

	// Before the connection is ready, we need to not send any updates
	#ready = false
	#currentUpgradeIndex = 0

	constructor(
		ipcWrapper: IpcWrapper<HostToModuleEventsV0, ModuleToHostEventsV0>,
		controlsController: ControlsController,
		pageStore: IPageStore,
		connectionId: string
	) {
		this.#logger = LogController.createLogger(`Instance/EntityManager/${connectionId}`)
		this.#ipcWrapper = ipcWrapper
		this.#controlsController = controlsController
		this.#pageStore = pageStore
	}

	readonly #debounceProcessPending = debounceFn(
		() => {
			if (!this.#ready) return

			const entityIdsInThisBatch = new Map<string, string>()
			const upgradePayload: UpgradeActionAndFeedbackInstancesMessage = {
				actions: [],
				feedbacks: [],
				defaultUpgradeIndex: 0, // TODO - remove this!
			}
			const updateActionsPayload: UpdateActionInstancesMessage = {
				actions: {},
			}
			const updateFeedbacksPayload: UpdateFeedbackInstancesMessage = {
				feedbacks: {},
			}

			const pushEntityToUpgrade = (wrapper: EntityWrapper) => {
				entityIdsInThisBatch.set(wrapper.entity.id, wrapper.wrapperId)
				const entityModel = wrapper.entity.asEntityModel(false)
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
						this.#logger.warn('Unknown entity type', wrapper.entity.type)
				}
			}

			const controlImageSizeCache = new Map<string, ModuleFeedbackInstance['image']>()

			// First, look over all the entiites and figure out what needs to be done to each
			for (const [entityId, wrapper] of this.#entities) {
				switch (wrapper.state) {
					case EntityState.UNLOADED:
						// The entity is unloaded, it either needs to be upgraded or loaded
						if (
							wrapper.entity.upgradeIndex === undefined ||
							wrapper.entity.upgradeIndex === this.#currentUpgradeIndex
						) {
							wrapper.state = EntityState.READY

							const entityModel = wrapper.entity.asEntityModel(false)

							// Parse the options and track the variables referenced
							const controlLocation = this.#pageStore.getLocationOfControlId(wrapper.controlId)
							const { parsedOptions, referencedVariableIds } = this.parseOptionsObject(
								wrapper.entity.getEntityDefinition(),
								entityModel.options,
								controlLocation
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
									this.#logger.warn('Unknown entity type', wrapper.entity.type)
							}
						} else {
							wrapper.state = EntityState.UPGRADING
							pushEntityToUpgrade(wrapper)
						}
						break
					case EntityState.UPGRADING:
					case EntityState.UPGRADING_INVALIDATED:
						// In progress, ignore
						break
					case EntityState.READY:
						// Already processed, ignore
						break
					case EntityState.PENDING_DELETE:
						// Plan for deletion
						this.#entities.delete(entityId)

						switch (wrapper.entity.type) {
							case EntityModelType.Action:
								updateActionsPayload.actions[entityId] = null
								break
							case EntityModelType.Feedback:
								updateFeedbacksPayload.feedbacks[entityId] = null
								break
							default:
								assertNever(wrapper.entity.type)
								this.#logger.warn('Unknown entity type', wrapper.entity.type)
						}
						break

					default:
						assertNever(wrapper.state)
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
			if (upgradePayload.actions.length > 0 || upgradePayload.feedbacks.length > 0) {
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

									switch (wrapper.entity.type) {
										case EntityModelType.Action: {
											const action = upgradedActions.get(wrapper.entity.id)
											if (action) {
												control.entities.entityReplace({
													id: action.id,
													type: EntityModelType.Action,
													definitionId: action.actionId,
													options: action.options,
													upgradeIndex: action.upgradeIndex ?? this.#currentUpgradeIndex,
												})
											}
											break
										}
										case EntityModelType.Feedback: {
											const feedback = upgradedFeedbacks.get(wrapper.entity.id)
											if (feedback) {
												control.entities.entityReplace({
													id: feedback.id,
													type: EntityModelType.Feedback,
													definitionId: feedback.feedbackId,
													options: feedback.options,
													style: feedback.style,
													isInverted: feedback.isInverted,
													upgradeIndex: feedback.upgradeIndex ?? this.#currentUpgradeIndex,
												})
											}
											break
										}
										default:
											assertNever(wrapper.entity.type)
											break
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

						// There isn't much we can do to retry the upgrad, the best we can do is pretend it was fine and progress the entities through the process
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
		},
		{
			before: false,
			after: true,
			maxWait: 50,
			wait: 10,
		}
	)

	start(currentUpgradeIndex: number): void {
		this.#ready = true
		this.#currentUpgradeIndex = currentUpgradeIndex

		this.#debounceProcessPending()
	}

	destroy(): void {
		this.#debounceProcessPending.cancel()
		this.#entities.clear()
		this.#ready = false
	}

	trackEntity(entity: ControlEntityInstance, controlId: string): void {
		// This may replace an existing entity, if so it needs to follow the usual process
		this.#entities.set(entity.id, {
			wrapperId: nanoid(),
			entity,
			controlId: controlId,
			state: EntityState.UNLOADED,
		})

		this.#debounceProcessPending()
	}

	forgetEntity(entityId: string): void {
		const wrapper = this.#entities.get(entityId)
		if (!wrapper) return

		// mark as pending deletion
		wrapper.state = EntityState.PENDING_DELETE

		this.#debounceProcessPending()
	}

	resendFeedbacks(): void {
		for (const entity of this.#entities.values()) {
			if (entity.entity.type !== EntityModelType.Feedback) continue

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

	parseOptionsObject(
		entityDefinition: ClientEntityDefinition | undefined,
		options: OptionsObject,
		location: ControlLocation | undefined
	): {
		parsedOptions: OptionsObject
		referencedVariableIds: Set<string>
	} {
		if (!entityDefinition)
			// If we don't know what fields need parsing, we can't do anything
			return { parsedOptions: options, referencedVariableIds: new Set() }

		const parsedOptions: OptionsObject = {}
		const referencedVariableIds = new Set<string>()

		const parser = this.#controlsController.createVariablesAndExpressionParser(location, null)

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
			for (const variable of parseResult.variableIds) {
				referencedVariableIds.add(variable)
			}
		}

		return { parsedOptions, referencedVariableIds }
	}

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
}
