import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { trpc, useMutationExt } from '~/TRPC'

export type ConnectionCollectionsApi = NestingCollectionsApi

export function useConnectionCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): ConnectionCollectionsApi {
	const { socket } = useContext(RootAppStoreContext)

	const createMutation = useMutationExt(trpc.connections.collections.add.mutationOptions())
	const renameMutation = useMutationExt(trpc.connections.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.connections.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.connections.collections.reorder.mutationOptions())

	return useMemo(
		() =>
			({
				createCollection: (collectionName = 'New Collection') => {
					createMutation.mutateAsync({ collectionName }).catch((e) => {
						console.error('Failed to add collection', e)
					})
				},
				renameCollection: (collectionId: string, newName: string) => {
					renameMutation.mutateAsync({ collectionId, collectionName: newName }).catch((e) => {
						console.error('Failed to rename collection', e)
					})
				},

				deleteCollection: (collectionId: string) => {
					confirmModalRef.current?.show(
						'Delete Collection',
						'Are you sure you want to delete this collection? All connections in this collection will be moved to Ungrouped Connections.',
						'Delete',
						() => {
							deleteMutation.mutateAsync({ collectionId }).catch((e) => {
								console.error('Failed to delete collection', e)
							})
						}
					)
				},

				moveCollection: (collectionId: string, parentId: string | null, dropIndex: number) => {
					reorderMutation.mutateAsync({ collectionId, parentId, dropIndex }).catch((e) => {
						console.error('Failed to reorder collection', e)
					})
				},
				moveItemToCollection: (itemId: string, collectionId: string | null, dropIndex: number) => {
					socket.emitPromise('connections:reorder', [collectionId, itemId, dropIndex]).catch((e) => {
						console.error('Reorder failed', e)
					})
				},
			}) satisfies ConnectionCollectionsApi,
		[socket, confirmModalRef, createMutation, renameMutation, deleteMutation, reorderMutation]
	)
}
