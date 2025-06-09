import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'

export type TriggerCollectionsApi = NestingCollectionsApi

export function useTriggerCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): TriggerCollectionsApi {
	const { socket } = useContext(RootAppStoreContext)

	return useMemo(
		() =>
			({
				createCollection: (collectionName = 'New Collection') => {
					socket.emitPromise('trigger-collections:add', [collectionName]).catch((e) => {
						console.error('Failed to add collection', e)
					})
				},

				renameCollection: (collectionId: string, newName: string) => {
					socket.emitPromise('trigger-collections:set-name', [collectionId, newName]).catch((e) => {
						console.error('Failed to rename collection', e)
					})
				},

				deleteCollection: (collectionId: string) => {
					confirmModalRef.current?.show(
						'Delete Collection',
						'Are you sure you want to delete this collection? All triggers in this collection will be moved to Ungrouped Triggers.',
						'Delete',
						() => {
							socket.emitPromise('trigger-collections:remove', [collectionId]).catch((e) => {
								console.error('Failed to delete collection', e)
							})
						}
					)
				},

				moveCollection: (collectionId: string, parentId: string | null, dropIndex: number) => {
					socket.emitPromise('trigger-collections:reorder', [collectionId, parentId, dropIndex]).catch((e) => {
						console.error('Failed to reorder collection', e)
					})
				},
				moveItemToCollection: (itemId: string, collectionId: string | null, dropIndex: number) => {
					socket
						.emitPromise('triggers:reorder', [collectionId, CreateTriggerControlId(itemId), dropIndex])
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies TriggerCollectionsApi,
		[socket, confirmModalRef]
	)
}
