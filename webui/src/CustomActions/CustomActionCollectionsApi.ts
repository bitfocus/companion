import { useMemo } from 'react'
import { CreateCustomActionControlId } from '@companion-app/shared/ControlId.js'
import type { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export type CustomActionCollectionsApi = NestingCollectionsApi

export function useCustomActionCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef | null>
): CustomActionCollectionsApi {
	const renameMutation = useMutationExt(trpc.controls.customActions.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.customActions.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.customActions.collections.reorder.mutationOptions())
	const moveItemMutation = useMutationExt(trpc.controls.customActions.reorder.mutationOptions())

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
						'Are you sure you want to delete this collection? All custom actions in this collection will be moved out of it.',
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
							controlId: CreateCustomActionControlId(itemId),
							dropIndex,
						})
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies CustomActionCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, moveItemMutation]
	)
}
