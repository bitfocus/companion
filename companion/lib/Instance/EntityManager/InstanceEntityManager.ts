import type {
	FeedbackInstance as ModuleFeedbackInstance,
	HostToModuleEventsV0,
	ModuleToHostEventsV0,
	UpdateActionInstancesMessage,
	UpdateFeedbackInstancesMessage,
	UpgradeActionAndFeedbackInstancesMessage,
} from '@companion-module/base/dist/host-api/api.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { EntityModelType, SomeReplaceableEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { IpcWrapper } from '@companion-module/base/dist/host-api/ipc-wrapper.js'
import type { ControlsController } from '../../Controls/Controller.js'
import LogController from '../../Log/Controller.js'

import { EntityManager, EntityManagerMethods } from './EntityManager.js'

export function createInstanceEntityManager(
	ipcWrapper: IpcWrapper<HostToModuleEventsV0, ModuleToHostEventsV0>,
	controlsController: ControlsController,
	connectionId: string
): EntityManager {
	const logger = LogController.createLogger(`Instance/EntityManager/${connectionId}`)

	const instanceMethods: EntityManagerMethods = {
		async updateEntities(entities) {
			const updateActionsPayload: UpdateActionInstancesMessage = {
				actions: {},
			}
			const updateFeedbacksPayload: UpdateFeedbackInstancesMessage = {
				feedbacks: {},
			}

			const controlImageSizeCache = new Map<string, ModuleFeedbackInstance['image']>()

			for (const entityInfo of entities) {
				if (entityInfo.type === 'delete') {
					// Deletion
					switch (entityInfo.entityType) {
						case EntityModelType.Action:
							updateActionsPayload.actions[entityInfo.entityId] = null
							break
						case EntityModelType.Feedback:
							updateFeedbacksPayload.feedbacks[entityInfo.entityId] = null
							break
						default:
							assertNever(entityInfo.entityType)
							logger.warn('Unknown entity type: ' + entityInfo.entityType)
					}
				} else if (entityInfo.type === 'update') {
					const { controlId, entityId, entityModel, parsedOptions } = entityInfo

					const entityType = entityModel.type
					switch (entityModel.type) {
						case EntityModelType.Action:
							updateActionsPayload.actions[entityId] = {
								id: entityModel.id,
								controlId: controlId,
								actionId: entityModel.definitionId,
								options: parsedOptions,

								upgradeIndex: entityModel.upgradeIndex ?? null,
								disabled: !!entityModel.disabled,
							}
							break
						case EntityModelType.Feedback: {
							let imageSize: ModuleFeedbackInstance['image'] | undefined
							if (controlImageSizeCache.has(controlId)) {
								imageSize = controlImageSizeCache.get(controlId)
							} else {
								const control = controlsController.getControl(controlId)
								imageSize = control?.getBitmapSize() ?? undefined
								controlImageSizeCache.set(controlId, imageSize)
							}

							updateFeedbacksPayload.feedbacks[entityId] = {
								id: entityModel.id,
								controlId: controlId,
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
							logger.warn('Unknown entity type', entityType)
					}
				} else {
					assertNever(entityInfo)
				}
			}

			if (Object.keys(updateActionsPayload.actions).length > 0) {
				ipcWrapper.sendWithCb('updateActions', updateActionsPayload).catch((e) => {
					logger.error('Error sending updateActions', e)
				})
			}
			if (Object.keys(updateFeedbacksPayload.feedbacks).length > 0) {
				ipcWrapper.sendWithCb('updateFeedbacks', updateFeedbacksPayload).catch((e) => {
					logger.error('Error sending updateFeedbacks', e)
				})
			}
		},

		async upgradeEntities(entities, currentUpgradeIndex) {
			const upgradePayload: UpgradeActionAndFeedbackInstancesMessage = {
				actions: [],
				feedbacks: [],
				defaultUpgradeIndex: 0, // TODO - remove this!
			}

			for (const { controlId, entityModel } of entities) {
				const entityType = entityModel.type
				switch (entityModel.type) {
					case EntityModelType.Action:
						upgradePayload.actions.push({
							id: entityModel.id,
							controlId: controlId,
							actionId: entityModel.definitionId,
							options: entityModel.options,

							upgradeIndex: entityModel.upgradeIndex ?? null,
							disabled: !!entityModel.disabled,
						})
						break
					case EntityModelType.Feedback:
						upgradePayload.feedbacks.push({
							id: entityModel.id,
							controlId: controlId,
							feedbackId: entityModel.definitionId,
							options: entityModel.options,

							isInverted: !!entityModel.isInverted,

							upgradeIndex: entityModel.upgradeIndex ?? null,
							disabled: !!entityModel.disabled,
						})
						break
					default:
						assertNever(entityModel)
						logger.warn('Unknown entity type', entityType)
				}
			}

			const upgradeResult = await ipcWrapper.sendWithCb('upgradeActionsAndFeedbacks', upgradePayload)

			const replacableModels: SomeReplaceableEntityModel[] = []

			for (const action of upgradeResult.updatedActions) {
				replacableModels.push({
					id: action.id,
					type: EntityModelType.Action,
					definitionId: action.actionId,
					options: action.options,
					upgradeIndex: currentUpgradeIndex,
				})
			}
			for (const feedback of upgradeResult.updatedFeedbacks) {
				replacableModels.push({
					id: feedback.id,
					type: EntityModelType.Feedback,
					definitionId: feedback.feedbackId,
					options: feedback.options,
					style: feedback.style,
					isInverted: feedback.isInverted,
					upgradeIndex: currentUpgradeIndex,
				})
			}

			return replacableModels
		},
	}

	return new EntityManager(instanceMethods, controlsController, connectionId)
}
