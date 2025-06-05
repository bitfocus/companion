import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { GroupApi } from '~/Components/GroupingTable/Types.js'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'

export interface TriggerGroupsApi extends GroupApi {}

export function useTriggerGroupsApi(confirmModalRef: React.RefObject<GenericConfirmModalRef>): TriggerGroupsApi {
	const { socket } = useContext(RootAppStoreContext)

	return useMemo(
		() =>
			({
				addNewGroup: (groupName = 'New Group') => {
					socket.emitPromise('trigger-groups:add', [groupName]).catch((e) => {
						console.error('Failed to add group', e)
					})
				},

				renameGroup: (groupId: string, newName: string) => {
					socket.emitPromise('trigger-groups:set-name', [groupId, newName]).catch((e) => {
						console.error('Failed to rename group', e)
					})
				},

				deleteGroup: (groupId: string) => {
					confirmModalRef.current?.show(
						'Delete Group',
						'Are you sure you want to delete this group? All triggers in this group will be moved to Ungrouped Triggers.',
						'Delete',
						() => {
							socket.emitPromise('trigger-groups:remove', [groupId]).catch((e) => {
								console.error('Failed to delete group', e)
							})
						}
					)
				},

				moveGroup: (groupId: string, parentId: string | null, dropIndex: number) => {
					socket.emitPromise('trigger-groups:reorder', [groupId, parentId, dropIndex]).catch((e) => {
						console.error('Failed to reorder group', e)
					})
				},
				moveItemToGroup: (itemId: string, groupId: string | null, dropIndex: number) => {
					socket.emitPromise('triggers:reorder', [groupId, CreateTriggerControlId(itemId), dropIndex]).catch((e) => {
						console.error('Reorder failed', e)
					})
				},
			}) satisfies TriggerGroupsApi,
		[socket, confirmModalRef]
	)
}
