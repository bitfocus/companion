import { useMemo } from 'react'
import { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal'

export type SurfaceInstancesCollectionsApi = NestingCollectionsApi

export function useSurfaceInstancesCollectionsApi(
	_configModalRef: React.RefObject<GenericConfirmModalRef>
): SurfaceInstancesCollectionsApi {
	return useMemo(
		() =>
			({
				renameCollection: (_collectionId: string, _newName: string) => {
					throw new Error('Collections not supported.')
				},

				deleteCollection: (_collectionId: string) => {
					throw new Error('Collections not supported.')
				},

				moveCollection: (_collectionId: string, _parentId: string | null, _dropIndex: number) => {
					throw new Error('Collections not supported.')
				},
				moveItemToCollection: (connectionId: string, _collectionId: string | null, dropIndex: number) => {
					console.log('do reorder?', connectionId, dropIndex)
					// reorderItemsMutation.mutateAsync({ connectionId, collectionId, dropIndex }).catch((e) => {
					// 	console.error('Reorder failed', e)
					// })
				},
			}) satisfies SurfaceInstancesCollectionsApi,
		[]
	)
}
