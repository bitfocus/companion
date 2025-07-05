import { useMemo } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { trpc, useMutationExt } from '~/TRPC'
import { CreateCustomVariableControlId } from '@companion-app/shared/ControlId.js'

export type CustomVariablesCollectionsApi = NestingCollectionsApi

export function useCustomVariablesCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): CustomVariablesCollectionsApi {
	const renameMutation = useMutationExt(trpc.controls.customVariables.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.customVariables.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.customVariables.collections.reorder.mutationOptions())
	const reorderItemMutation = useMutationExt(trpc.controls.customVariables.reorder.mutationOptions())

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
						'Are you sure you want to delete this collection? All custom variables in this collection will be moved to Ungrouped Custom Variables.',
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
					reorderItemMutation
						.mutateAsync({ controlId: CreateCustomVariableControlId(itemId), collectionId, dropIndex })
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies CustomVariablesCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, reorderItemMutation]
	)
}
