import { useMemo } from 'react'
import { CreateCustomPresetControlId } from '@companion-app/shared/ControlId.js'
import type { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export type CustomPresetCollectionsApi = NestingCollectionsApi

export function useCustomPresetCollectionsApi(
	confirmModalRef: React.RefObject<GenericConfirmModalRef | null>
): CustomPresetCollectionsApi {
	const renameMutation = useMutationExt(trpc.controls.customPresets.collections.setName.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.customPresets.collections.remove.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.customPresets.collections.reorder.mutationOptions())
	const moveItemMutation = useMutationExt(trpc.controls.customPresets.reorder.mutationOptions())

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
						'Are you sure you want to delete this collection? All custom presets in this collection will be moved out of it.',
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
							controlId: CreateCustomPresetControlId(itemId),
							dropIndex,
						})
						.catch((e) => {
							console.error('Reorder failed', e)
						})
				},
			}) satisfies CustomPresetCollectionsApi,
		[confirmModalRef, renameMutation, deleteMutation, reorderMutation, moveItemMutation]
	)
}
