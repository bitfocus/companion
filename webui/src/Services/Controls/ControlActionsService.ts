import { useContext, useMemo } from 'react'
import { SocketContext } from '../../util.js'
import type { IEntityEditorService } from './ControlEntitiesService.js'
import type { EntityOwner, SomeEntityModel, SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'

export function useActionRecorderActionService(sessionId: string): IEntityEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			listId: 'trigger_actions',
			confirmModal: { current: null }, // TODO this is a hack

			addEntity: (_connectionId: string, _definitionId: string, _ownerId: EntityOwner | null) => {
				// Not supported
			},
			moveCard: (
				_dragListId: SomeSocketEntityLocation,
				dragEntityId: string,
				_dropOwnerId: EntityOwner | null,
				dropIndex: number
			) => {
				socket
					.emitPromise('action-recorder:session:action-reorder', [sessionId, dragEntityId, dropIndex])
					.catch((e) => {
						console.error(e)
					})
			},

			setValue: (entityId: string, _action: SomeEntityModel | undefined, key: string, value: any) => {
				socket.emitPromise('action-recorder:session:action-set-value', [sessionId, entityId, key, value]).catch((e) => {
					console.error(e)
				})
			},

			setConnection: (_entityId: string, _connectionId: string) => {
				// Not implemented in action recorder
			},

			setDelay: (entityId: string, delay: number) => {
				socket.emitPromise('action-recorder:session:action-delay', [sessionId, entityId, delay]).catch((e) => {
					console.error(e)
				})
			},

			performDelete: (entityId: string) => {
				socket.emitPromise('action-recorder:session:action-delete', [sessionId, entityId]).catch((e) => {
					console.error(e)
				})
			},

			performDuplicate: (entityId: string) => {
				socket.emitPromise('action-recorder:session:action-duplicate', [sessionId, entityId]).catch((e) => {
					console.error(e)
				})
			},

			performLearn: undefined,
			setEnabled: undefined,
			setHeadline: undefined,

			setInverted: (_entityId: string, _inverted: boolean) => {
				// Not supported
			},

			setSelectedStyleProps: (_entityId: string, _keys: string[]) => {
				// Not supported
			},

			setStylePropsValue: (_entityId: string, _key: string, _value: any) => {
				// Not supported
			},
		}),
		[socket, sessionId]
	)
}
