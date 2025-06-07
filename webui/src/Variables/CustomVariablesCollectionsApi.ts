import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'

export interface CustomVariablesCollectionsApi extends NestingCollectionsApi {}

export function useCustomVariablesCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): CustomVariablesCollectionsApi {
	const { socket } = useContext(RootAppStoreContext)

	return useMemo(
		() =>
			({
				createCollection: (collectionName = 'New Collection') => {
					socket.emitPromise('custom-variable-collections:add', [collectionName]).catch((e) => {
						console.error('Failed to add collection', e)
					})
				},

				renameCollection: (collectionId: string, newName: string) => {
					socket.emitPromise('custom-variable-collections:set-name', [collectionId, newName]).catch((e) => {
						console.error('Failed to rename collection', e)
					})
				},

				deleteCollection: (collectionId: string) => {
					confirmModalRef.current?.show(
						'Delete Collection',
						'Are you sure you want to delete this collection? All custom variables in this collection will be moved to Ungrouped Custom Variables.',
						'Delete',
						() => {
							socket.emitPromise('custom-variable-collections:remove', [collectionId]).catch((e) => {
								console.error('Failed to delete collection', e)
							})
						}
					)
				},

				moveCollection: (collectionId: string, parentId: string | null, dropIndex: number) => {
					socket.emitPromise('custom-variable-collections:reorder', [collectionId, parentId, dropIndex]).catch((e) => {
						console.error('Failed to reorder collection', e)
					})
				},
				moveItemToCollection: (itemId: string, collectionId: string | null, dropIndex: number) => {
					socket.emitPromise('custom-variables:reorder', [collectionId, itemId, dropIndex]).catch((e) => {
						console.error('Reorder failed', e)
					})
				},
			}) satisfies CustomVariablesCollectionsApi,
		[socket, confirmModalRef]
	)
}
