import {
	EntityModelType,
	EntityOwner,
	SomeEntityModel,
	stringifySocketEntityLocation,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { useContext, useMemo, useRef } from 'react'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { SocketContext } from '../../util.js'

export interface IEntityEditorService {
	readonly listId: SomeSocketEntityLocation
	readonly confirmModal: React.RefObject<GenericConfirmModalRef>

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

	setInverted: (entityId: string, inverted: boolean) => void
	setVariableName: (entityId: string, name: string) => void
	setVariableValue: (entityId: string, value: any) => void
	setSelectedStyleProps: (entityId: string, keys: string[]) => void
	setStylePropsValue: (entityId: string, key: string, value: any) => void
}

export interface IEntityEditorActionService {
	setValue: (key: string, val: any) => void
	performDelete: () => void
	performDuplicate: () => void
	setConnection: (connectionId: string) => void
	performLearn: (() => void) | undefined
	setEnabled: ((enabled: boolean) => void) | undefined
	setHeadline: ((headline: string) => void) | undefined

	setInverted: (inverted: boolean) => void
	setVariableName: (name: string) => void
	setVariableValue: (value: any) => void
	setSelectedStyleProps: (keys: string[]) => void
	setStylePropsValue: (key: string, value: any) => void
}

export function useControlEntitiesEditorService(
	controlId: string,
	listId: SomeSocketEntityLocation,
	entityTypeLabel: string,
	entityModelType: EntityModelType,
	confirmModal: React.RefObject<GenericConfirmModalRef>
): IEntityEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			listId,
			confirmModal,

			addEntity: (connectionId: string, definitionId: string, ownerId: EntityOwner | null) => {
				socket
					.emitPromise('controls:entity:add', [controlId, listId, ownerId, connectionId, entityModelType, definitionId])
					.catch((e) => {
						console.error('Failed to add control entity', e)
					})
			},

			moveCard: (
				dragListId: SomeSocketEntityLocation,
				dragEntityId: string,
				dropOwnerId: EntityOwner | null,
				dropIndex: number
			) => {
				socket
					.emitPromise('controls:entity:move', [controlId, dragListId, dragEntityId, dropOwnerId, listId, dropIndex])
					.catch((e) => {
						console.error('Failed to reorder control entitys', e)
					})
			},

			setValue: (entityId: string, entity: SomeEntityModel | undefined, key: string, val: any) => {
				if (!entity?.options || entity.options[key] !== val) {
					socket.emitPromise('controls:entity:set-option', [controlId, listId, entityId, key, val]).catch((e) => {
						console.error('Failed to set control entity option', e)
					})
				}
			},

			setConnection: (entityId: string, connectionId: string) => {
				socket.emitPromise('controls:entity:set-connection', [controlId, listId, entityId, connectionId]).catch((e) => {
					console.error('Failed to set control entity connection', e)
				})
			},

			performDelete: (entityId: string) => {
				confirmModal.current?.show(`Delete ${entityTypeLabel}`, `Delete ${entityTypeLabel}?`, 'Delete', () => {
					socket.emitPromise('controls:entity:remove', [controlId, listId, entityId]).catch((e) => {
						console.error('Failed to remove control entity', e)
					})
				})
			},

			performDuplicate: (entityId: string) => {
				socket.emitPromise('controls:entity:duplicate', [controlId, listId, entityId]).catch((e) => {
					console.error('Failed to duplicate control entity', e)
				})
			},

			performLearn: (entityId: string) => {
				socket.emitPromise('controls:entity:learn', [controlId, listId, entityId]).catch((e) => {
					console.error('Failed to learn control entity values', e)
				})
			},

			setEnabled: (entityId: string, enabled: boolean) => {
				socket.emitPromise('controls:entity:enabled', [controlId, listId, entityId, enabled]).catch((e) => {
					console.error('Failed to enable/disable entity', e)
				})
			},
			setHeadline: (entityId: string, headline: string) => {
				socket.emitPromise('controls:entity:set-headline', [controlId, listId, entityId, headline]).catch((e) => {
					console.error('Failed to set entity headline', e)
				})
			},

			setInverted: (entityId: string, inverted: boolean) => {
				socket.emitPromise('controls:entity:set-inverted', [controlId, listId, entityId, inverted]).catch((e) => {
					console.error('Failed to set entity inverted', e)
				})
			},

			setVariableName: (entityId: string, name: string) => {
				socket.emitPromise('controls:entity:set-variable-name', [controlId, listId, entityId, name]).catch((e) => {
					console.error('Failed to set entity variable name', e)
				})
			},
			setVariableValue: (entityId: string, value: any) => {
				socket.emitPromise('controls:entity:set-variable-value', [controlId, listId, entityId, value]).catch((e) => {
					console.error('Failed to set entity variable value', e)
				})
			},

			setSelectedStyleProps: (entityId: string, keys: string[]) => {
				socket.emitPromise('controls:entity:set-style-selection', [controlId, listId, entityId, keys]).catch((e) => {
					console.error('Failed to set entity style selected props', e)
				})
			},

			setStylePropsValue: (entityId: string, key: string, value: any) => {
				socket.emitPromise('controls:entity:set-style-value', [controlId, listId, entityId, key, value]).catch((e) => {
					console.error('Failed to set entity style value', e)
				})
			},
		}),
		[socket, confirmModal, controlId, stringifySocketEntityLocation(listId), entityTypeLabel]
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
			setInverted: (inverted: boolean) => serviceFactory.setInverted(entityId, inverted),
			setVariableName: (name: string) => serviceFactory.setVariableName(entityId, name),
			setVariableValue: (value: any) => serviceFactory.setVariableValue(entityId, value),
			setSelectedStyleProps: (keys: string[]) => serviceFactory.setSelectedStyleProps(entityId, keys),
			setStylePropsValue: (key: string, value: any) => serviceFactory.setStylePropsValue(entityId, key, value),
		}),
		[socket, serviceFactory, entityId]
	)
}
