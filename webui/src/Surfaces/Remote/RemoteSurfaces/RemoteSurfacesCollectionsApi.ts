import { useMemo } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import type { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export type RemoteSurfacesCollectionsApi = NestingCollectionsApi

export function useRemoteSurfacesCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): RemoteSurfacesCollectionsApi {
	const renameMutation = useMutationExt(trpc.surfaces.outbound.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.surfaces.outbound.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.surfaces.outbound.collections.reorder.mutationOptions())
	const reorderItemsMutation = useMutationExt(trpc.surfaces.outbound.reorder.mutationOptions())

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
						'Are you sure you want to delete this collection? All surface connections in this collection will be moved to Ungrouped Remote Surface Connections.',
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
			}) satisfies RemoteSurfacesCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, reorderItemsMutation]
	)
}
