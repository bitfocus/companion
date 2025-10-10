import { useMemo } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export type ConnectionCollectionsApi = NestingCollectionsApi

export function useConnectionCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): ConnectionCollectionsApi {
	const renameMutation = useMutationExt(trpc.instances.connections.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.instances.connections.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.instances.connections.collections.reorder.mutationOptions())
	const reorderItemsMutation = useMutationExt(trpc.instances.connections.reorder.mutationOptions())

	return useMemo(
		() =>
			({
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
				moveItemToCollection: (connectionId: string, collectionId: string | null, dropIndex: number) => {
					reorderItemsMutation.mutateAsync({ connectionId, collectionId, dropIndex }).catch((e) => {
						console.error('Reorder failed', e)
					})
				},
			}) satisfies ConnectionCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, reorderItemsMutation]
	)
}
