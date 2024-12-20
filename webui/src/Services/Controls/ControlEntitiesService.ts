import {
	EntityModelType,
	EntityOwner,
	SomeEntityModel,
	stringifySocketEntityLocation,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { useContext, useMemo, useRef } from 'react'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { SocketContext, socketEmitPromise } from '../../util.js'

export interface IEntityEditorService {
	addEntity: (connectionId: string, definitionId: string, ownerId: EntityOwner | null) => void

	setValue: (entityId: string, entity: SomeEntityModel | undefined, key: string, val: any) => void
	performDelete: (entityId: string) => void
	performDuplicate: (entityId: string) => void
	setConnection: (entityId: string, connectionId: string) => void
	moveCard: (
		dragListId: SomeSocketEntityLocation,
		dragEntityId: string,
		dropOwnerId: EntityOwner | null,
		dropIndex: number
	) => void
	performLearn: ((entityId: string) => void) | undefined
	setEnabled: ((entityId: string, enabled: boolean) => void) | undefined
	setHeadline: ((entityId: string, headline: string) => void) | undefined
}

export interface IEntityEditorActionService {
	setValue: (key: string, val: any) => void
	performDelete: () => void
	performDuplicate: () => void
	setConnection: (connectionId: string) => void
	performLearn: (() => void) | undefined
	setEnabled: ((enabled: boolean) => void) | undefined
	setHeadline: ((headline: string) => void) | undefined
}

export function useControlEntitiesEditorService(
	controlId: string,
	listId: SomeSocketEntityLocation,
	entityType: string,
	entityModelType: EntityModelType,
	confirmModal: React.RefObject<GenericConfirmModalRef>
): IEntityEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			addEntity: (connectionId: string, definitionId: string, ownerId: EntityOwner | null) => {
				socketEmitPromise(socket, 'controls:entity:add', [
					controlId,
					listId,
					ownerId,
					connectionId,
					entityModelType,
					definitionId,
				]).catch((e) => {
					console.error('Failed to add control entity', e)
				})
			},

			moveCard: (
				dragListId: SomeSocketEntityLocation,
				dragEntityId: string,
				dropOwnerId: EntityOwner | null,
				dropIndex: number
			) => {
				socketEmitPromise(socket, 'controls:entity:move', [
					controlId,
					dragListId,
					dragEntityId,
					dropOwnerId,
					listId,
					dropIndex,
				]).catch((e) => {
					console.error('Failed to reorder control entitys', e)
				})
			},

			setValue: (entityId: string, entity: SomeEntityModel | undefined, key: string, val: any) => {
				if (!entity?.options || entity.options[key] !== val) {
					socketEmitPromise(socket, 'controls:entity:set-option', [controlId, listId, entityId, key, val]).catch(
						(e) => {
							console.error('Failed to set control entity option', e)
						}
					)
				}
			},

			setConnection: (entityId: string, connectionId: string) => {
				socketEmitPromise(socket, 'controls:entity:set-connection', [controlId, listId, entityId, connectionId]).catch(
					(e) => {
						console.error('Failed to set control entity connection', e)
					}
				)
			},

			performDelete: (entityId: string) => {
				confirmModal.current?.show(`Delete ${entityType}`, `Delete ${entityType}?`, 'Delete', () => {
					socketEmitPromise(socket, 'controls:entity:remove', [controlId, listId, entityId]).catch((e) => {
						console.error('Failed to remove control entity', e)
					})
				})
			},

			performDuplicate: (entityId: string) => {
				socketEmitPromise(socket, 'controls:entity:duplicate', [controlId, listId, entityId]).catch((e) => {
					console.error('Failed to duplicate control entity', e)
				})
			},

			performLearn: (entityId: string) => {
				socketEmitPromise(socket, 'controls:entity:learn', [controlId, listId, entityId]).catch((e) => {
					console.error('Failed to learn control entity values', e)
				})
			},

			setEnabled: (entityId: string, enabled: boolean) => {
				socketEmitPromise(socket, 'controls:entity:enabled', [controlId, listId, entityId, enabled]).catch((e) => {
					console.error('Failed to enable/disable entity', e)
				})
			},

			setHeadline: (entityId: string, headline: string) => {
				socketEmitPromise(socket, 'controls:entity:set-headline', [controlId, listId, entityId, headline]).catch(
					(e) => {
						console.error('Failed to set entity headline', e)
					}
				)
			},
		}),
		[socket, confirmModal, controlId, stringifySocketEntityLocation(listId), entityType]
	)
}

export function useControlEntityService(
	serviceFactory: IEntityEditorService,
	entity: SomeEntityModel
): IEntityEditorActionService {
	const socket = useContext(SocketContext)

	const entityRef = useRef<SomeEntityModel>()
	entityRef.current = entity

	const entityId = entity.id

	return useMemo(
		() => ({
			setValue: (key: string, val: any) => serviceFactory.setValue(entityId, entityRef.current, key, val),
			performDelete: () => serviceFactory.performDelete(entityId),
			performDuplicate: () => serviceFactory.performDuplicate(entityId),
			setConnection: (connectionId: string) => serviceFactory.setConnection(entityId, connectionId),
			performLearn: serviceFactory.performLearn ? () => serviceFactory.performLearn?.(entityId) : undefined,
			setEnabled: serviceFactory.setEnabled
				? (enabled: boolean) => serviceFactory.setEnabled?.(entityId, enabled)
				: undefined,
			setHeadline: serviceFactory.setHeadline
				? (headline: string) => serviceFactory.setHeadline?.(entityId, headline)
				: undefined,
		}),
		[socket, serviceFactory, entityId]
	)
}
