import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'

export interface ConnectionListApi {
	addNewGroup: () => void
	renameGroup: (groupId: string, newName: string) => void
	deleteGroup: (groupId: string) => void
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
			}) satisfies ConnectionListApi,
		[socket, confirmModalRef]
	)
}
