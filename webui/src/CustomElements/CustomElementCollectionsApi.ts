import { useMemo } from 'react'
import { CreateCustomElementControlId } from '@companion-app/shared/ControlId.js'
import type { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export type CustomElementCollectionsApi = NestingCollectionsApi

export function useCustomElementCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef | null>
): CustomElementCollectionsApi {
	const renameMutation = useMutationExt(trpc.controls.customElements.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.customElements.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.customElements.collections.reorder.mutationOptions())
	const moveItemMutation = useMutationExt(trpc.controls.customElements.reorder.mutationOptions())

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
						'Are you sure you want to delete this collection? All custom elements in this collection will be moved out of it.',
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
							controlId: CreateCustomElementControlId(itemId),
							dropIndex,
						})
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies CustomElementCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, moveItemMutation]
	)
}
