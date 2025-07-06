import { useMemo } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { trpc, useMutationExt } from '~/TRPC'

export type TriggerCollectionsApi = NestingCollectionsApi

export function useTriggerCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): TriggerCollectionsApi {
	const renameMutation = useMutationExt(trpc.controls.triggers.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.triggers.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.triggers.collections.reorder.mutationOptions())
	const moveItemMutation = useMutationExt(trpc.controls.triggers.reorder.mutationOptions())

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
					moveItemMutation
						.mutateAsync({
							collectionId,
							controlId: CreateTriggerControlId(itemId),
							dropIndex,
						})
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies TriggerCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, moveItemMutation]
	)
}
