import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { GroupApi } from '~/Components/GroupingTable/Types.js'

export interface ConnectionListApi extends GroupApi {}

export function useConnectionListApi(confirmModalRef: React.RefObject<GenericConfirmModalRef>): ConnectionListApi {
	const { socket } = useContext(RootAppStoreContext)

	return useMemo(
		() =>
			({
				addNewGroup: (groupName = 'New Collection') => {
					socket.emitPromise('connection-groups:add', [groupName]).catch((e) => {
						console.error('Failed to add collection', e)
					})
				},

				renameGroup: (groupId: string, newName: string) => {
					socket.emitPromise('connection-groups:set-name', [groupId, newName]).catch((e) => {
						console.error('Failed to rename collection', e)
					})
				},

				deleteGroup: (groupId: string) => {
					confirmModalRef.current?.show(
						'Delete Collection',
						'Are you sure you want to delete this collection? All connections in this collection will be moved to Ungrouped Connections.',
						'Delete',
						() => {
							socket.emitPromise('connection-groups:remove', [groupId]).catch((e) => {
								console.error('Failed to delete collection', e)
							})
						}
					)
				},

				moveGroup: (groupId: string, parentId: string | null, dropIndex: number) => {
					socket.emitPromise('connection-groups:reorder', [groupId, parentId, dropIndex]).catch((e) => {
						console.error('Failed to reorder collection', e)
					})
				},
				moveItemToGroup: (itemId: string, groupId: string | null, dropIndex: number) => {
					socket.emitPromise('connections:reorder', [groupId, itemId, dropIndex]).catch((e) => {
						console.error('Reorder failed', e)
					})
				},
			}) satisfies ConnectionListApi,
		[socket, confirmModalRef]
	)
}
