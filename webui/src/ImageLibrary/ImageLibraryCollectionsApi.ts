import { useMemo } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export type ImageLibraryCollectionsApi = NestingCollectionsApi

export function useImageLibraryCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): ImageLibraryCollectionsApi {
	const setNameCollectionMutation = useMutationExt(trpc.imageLibrary.collections.setName.mutationOptions())
	const removeCollectionMutation = useMutationExt(trpc.imageLibrary.collections.remove.mutationOptions())
	const reorderCollectionMutation = useMutationExt(trpc.imageLibrary.collections.reorder.mutationOptions())
	const reorderItemMutation = useMutationExt(trpc.imageLibrary.reorder.mutationOptions())

	return useMemo(
		() =>
			({
				renameCollection: (collectionId: string, newName: string) => {
					setNameCollectionMutation.mutateAsync({ collectionId, collectionName: newName }).catch((e) => {
						console.error('Failed to rename collection', e)
					})
				},

				deleteCollection: (collectionId: string) => {
					confirmModalRef.current?.show(
						'Delete Collection',
						'Are you sure you want to delete this collection? All images in this collection will be moved to Ungrouped Images.',
						'Delete',
						() => {
							removeCollectionMutation.mutateAsync({ collectionId }).catch((e) => {
								console.error('Failed to delete collection', e)
							})
						}
					)
				},

				moveCollection: (collectionId: string, parentId: string | null, dropIndex: number) => {
					reorderCollectionMutation.mutateAsync({ collectionId, parentId, dropIndex }).catch((e) => {
						console.error('Failed to reorder collection', e)
					})
				},
				moveItemToCollection: (itemId: string, collectionId: string | null, dropIndex: number) => {
					reorderItemMutation.mutateAsync({ imageName: itemId, collectionId, dropIndex }).catch((e) => {
						console.error('Reorder failed', e)
					})
				},
			}) satisfies ImageLibraryCollectionsApi,
		[
			reorderItemMutation,
			removeCollectionMutation,
			reorderCollectionMutation,
			setNameCollectionMutation,
			confirmModalRef,
		]
	)
}
