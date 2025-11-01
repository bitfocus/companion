import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { ClientSurfaceInstanceConfigWithId } from './SurfaceInstanceList.js'
import { useSurfaceInstancesListContext } from './SurfaceInstancesListContext.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { InstancesListTableRow } from '~/Instances/List/InstancesListTableRow.js'

interface SurfaceInstanceTableRowProps {
	instance: ClientSurfaceInstanceConfigWithId
	isSelected: boolean
}
export const SurfaceInstanceTableRow = observer(function SurfaceInstanceTableRow({
	instance,
	isSelected,
}: SurfaceInstanceTableRowProps) {
	const { surfaceInstances } = useContext(RootAppStoreContext)
	const { deleteModalRef, configureInstance } = useSurfaceInstancesListContext()

	const id = instance.id

	const deleteMutation = useMutationExt(trpc.instances.surfaces.delete.mutationOptions())
	const setEnabledMutation = useMutationExt(trpc.instances.surfaces.setEnabled.mutationOptions())

	const doDelete = useCallback(() => {
		deleteModalRef.current?.show(
			'Delete surface instance',
			[
				`Are you sure you want to delete "${instance.label}"?`,
				'This will disconnect all surfaces associated with this instance.',
			],
			'Delete',
			() => {
				deleteMutation.mutateAsync({ instanceId: id }).catch((e) => {
					console.error('Delete failed', e)
				})
				configureInstance(null)
			}
		)
	}, [deleteMutation, deleteModalRef, id, instance.label, configureInstance])

	const isEnabled = instance.enabled === undefined || instance.enabled
	const doToggleEnabled = useCallback(() => {
		setEnabledMutation.mutateAsync({ instanceId: id, enabled: !isEnabled }).catch((e) => {
			console.error('Set enabled failed', e)
		})
	}, [setEnabledMutation, id, isEnabled])

	const editClickId = isSelected ? null : id // If this row is selected, don't allow editing on click, as it will close the selection
	const doEdit = useCallback(() => configureInstance(editClickId), [configureInstance, editClickId])

	return (
		<InstancesListTableRow
			collectionsStore={surfaceInstances}
			instance={instance}
			instanceStatus={instance.status}
			labelStr="surface instance"
			doDelete={doDelete}
			doEdit={doEdit}
			doToggleEnabled={doToggleEnabled}
			debugLogUrl={`/surfaces/debug/${id}`}
		/>
	)
})
