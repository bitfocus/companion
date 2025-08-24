import { useMemo } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { CreateComputedVariableControlId } from '@companion-app/shared/ControlId.js'

export type ComputedVariablesCollectionsApi = NestingCollectionsApi

export function useComputedVariablesCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): ComputedVariablesCollectionsApi {
	const renameMutation = useMutationExt(trpc.controls.computedVariables.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.computedVariables.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.computedVariables.collections.reorder.mutationOptions())
	const reorderItemMutation = useMutationExt(trpc.controls.computedVariables.reorder.mutationOptions())

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
						'Are you sure you want to delete this collection? All computed variables in this collection will be moved to Ungrouped Computed Variables.',
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
						.mutateAsync({ controlId: CreateComputedVariableControlId(itemId), collectionId, dropIndex })
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies ComputedVariablesCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, reorderItemMutation]
	)
}
