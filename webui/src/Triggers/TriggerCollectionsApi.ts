import { useContext, useMemo } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { trpc, useMutationExt } from '~/TRPC'

export type TriggerCollectionsApi = NestingCollectionsApi

export function useTriggerCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): TriggerCollectionsApi {
	const { socket } = useContext(RootAppStoreContext)

	const renameMutation = useMutationExt(trpc.controls.triggerCollections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.triggerCollections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.triggerCollections.reorder.mutationOptions())

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
				moveItemToCollection: (itemId: string, collectionId: string | null, dropIndex: number) => {
					socket
						.emitPromise('triggers:reorder', [collectionId, CreateTriggerControlId(itemId), dropIndex])
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies TriggerCollectionsApi,
		[socket, confirmModalRef, renameMutation, deleteMutation, reorderMutation]
	)
}
