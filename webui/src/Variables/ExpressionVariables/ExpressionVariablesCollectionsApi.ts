import { useMemo } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import type { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { CreateExpressionVariableControlId } from '@companion-app/shared/ControlId.js'

export type ExpressionVariablesCollectionsApi = NestingCollectionsApi

export function useExpressionVariablesCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
): ExpressionVariablesCollectionsApi {
	const renameMutation = useMutationExt(trpc.controls.expressionVariables.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.expressionVariables.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.expressionVariables.collections.reorder.mutationOptions())
	const reorderItemMutation = useMutationExt(trpc.controls.expressionVariables.reorder.mutationOptions())

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
						'Are you sure you want to delete this collection? All expression variables in this collection will be moved to Ungrouped Expression Variables.',
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
						.mutateAsync({ controlId: CreateExpressionVariableControlId(itemId), collectionId, dropIndex })
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies ExpressionVariablesCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, reorderItemMutation]
	)
}
