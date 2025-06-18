import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'

export type ImageLibraryCollectionsApi = NestingCollectionsApi

export function useImageLibraryCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): ImageLibraryCollectionsApi {
	const { socket } = useContext(RootAppStoreContext)

	return useMemo(
		() =>
			({
				createCollection: (collectionName = 'New Collection') => {
					socket.emitPromise('image-library-collections:add', [collectionName]).catch((e) => {
						console.error('Failed to add collection', e)
					})
				},

				renameCollection: (collectionId: string, newName: string) => {
					socket.emitPromise('image-library-collections:set-name', [collectionId, newName]).catch((e) => {
						console.error('Failed to rename collection', e)
					})
				},

				deleteCollection: (collectionId: string) => {
					confirmModalRef.current?.show(
						'Delete Collection',
						'Are you sure you want to delete this collection? All images in this collection will be moved to Ungrouped Images.',
						'Delete',
						() => {
							socket.emitPromise('image-library-collections:remove', [collectionId]).catch((e) => {
								console.error('Failed to delete collection', e)
							})
						}
					)
				},

				moveCollection: (collectionId: string, parentId: string | null, dropIndex: number) => {
					socket.emitPromise('image-library-collections:reorder', [collectionId, parentId, dropIndex]).catch((e) => {
						console.error('Failed to reorder collection', e)
					})
				},
				moveItemToCollection: (itemId: string, collectionId: string | null, dropIndex: number) => {
					socket.emitPromise('image-library:reorder', [collectionId, itemId, dropIndex]).catch((e) => {
						console.error('Reorder failed', e)
					})
				},
			}) satisfies ImageLibraryCollectionsApi,
		[socket, confirmModalRef]
	)
}
