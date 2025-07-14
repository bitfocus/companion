import { useMemo } from 'react'
import type { IEntityEditorService } from './ControlEntitiesService.js'
import type { EntityOwner, SomeEntityModel, SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { trpc, useMutationExt } from '~/TRPC.js'

export function useActionRecorderActionService(sessionId: string): IEntityEditorService {
	const deleteActionMutation = useMutationExt(trpc.actionRecorder.session.action.delete.mutationOptions())
	const duplicateActionMutation = useMutationExt(trpc.actionRecorder.session.action.duplicate.mutationOptions())
	const setValueMutation = useMutationExt(trpc.actionRecorder.session.action.setValue.mutationOptions())
	const reorderActionMutation = useMutationExt(trpc.actionRecorder.session.action.reorder.mutationOptions())

	return useMemo(
		() => ({
			listId: 'trigger_actions',
			confirmModal: { current: null }, // TODO this is a hack

			addEntity: async (_connectionId: string, _definitionId: string, _ownerId: EntityOwner | null) => {
				// Not supported
				return null
			},
			moveCard: (
				_dragListId: SomeSocketEntityLocation,
				dragEntityId: string,
				_dropOwnerId: EntityOwner | null,
				dropIndex: number
			) => {
				reorderActionMutation.mutateAsync({ sessionId, actionId: dragEntityId, newIndex: dropIndex }).catch((e) => {
					console.error(e)
				})
			},

			setValue: (entityId: string, _action: SomeEntityModel | undefined, key: string, value: any) => {
				setValueMutation.mutateAsync({ sessionId, actionId: entityId, key, value }).catch((e) => {
					console.error(e)
				})
			},

			setConnection: (_entityId: string, _connectionId: string) => {
				// Not implemented in action recorder
			},

			performDelete: (actionId: string) => {
				deleteActionMutation.mutateAsync({ sessionId, actionId }).catch((e) => {
					console.error(e)
				})
			},

			performDuplicate: (entityId: string) => {
				duplicateActionMutation.mutateAsync({ sessionId, actionId: entityId }).catch((e) => {
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
		[sessionId, deleteActionMutation, duplicateActionMutation, setValueMutation, reorderActionMutation]
	)
}
