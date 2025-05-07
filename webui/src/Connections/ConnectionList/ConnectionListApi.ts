import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { GroupApi } from '../../Components/CollapsibleGroupRow.js'

export interface ConnectionListApi extends GroupApi {
	// setGroupEnabled: (groupId: string, enabled: boolean) => void
}

export function useConnectionListApi(confirmModalRef: React.RefObject<GenericConfirmModalRef>): ConnectionListApi {
	const { socket } = useContext(RootAppStoreContext)

	return useMemo(
		() =>
			({
				addNewGroup: () => {
					socket.emitPromise('connection-groups:add', ['New Group']).catch((e) => {
						console.error('Failed to add group', e)
					})
				},

				renameGroup: (groupId: string, newName: string) => {
					socket.emitPromise('connection-groups:set-name', [groupId, newName]).catch((e) => {
						console.error('Failed to rename group', e)
					})
				},

				deleteGroup: (groupId: string) => {
					confirmModalRef.current?.show(
						'Delete Group',
						'Are you sure you want to delete this group? All connections in this group will be moved to Ungrouped Connections.',
						'Delete',
						() => {
							socket.emitPromise('connection-groups:remove', [groupId]).catch((e) => {
								console.error('Failed to delete group', e)
							})
						}
					)
				},

				reorderGroup: (groupId: string, dropIndex: number) => {
					socket.emitPromise('connection-groups:reorder', [groupId, dropIndex]).catch((e) => {
						console.error('Failed to reorder group', e)
					})
				},
			}) satisfies ConnectionListApi,
		[socket, confirmModalRef]
	)
}
