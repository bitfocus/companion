import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext } from 'react'
import { useRemoteSurfacesListContext } from './RemoteSurfacesListContext.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { CButton, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface RemoteSurfaceTableRowProps {
	remoteConnection: OutboundSurfaceInfo
	isSelected: boolean
}
export const RemoteSurfaceTableRow = observer(function RemoteSurfaceTableRow({
	remoteConnection,
	isSelected,
}: RemoteSurfaceTableRowProps) {
	const { surfaceInstances } = useContext(RootAppStoreContext)

	const { deleteModalRef, configureRemoteConnection } = useRemoteSurfacesListContext()

	const id = remoteConnection.id

	const deleteMutation = useMutationExt(trpc.surfaces.outbound.remove.mutationOptions())
	const setEnabledMutation = useMutationExt(trpc.surfaces.outbound.setEnabled.mutationOptions())

	const doDelete = useCallback(() => {
		deleteModalRef.current?.show(
			'Delete surface remote connection',
			[
				`Are you sure you want to delete "${remoteConnection.displayName}"?`,
				'This will disconnect all surfaces opened through this connection.',
			],
			'Delete',
			() => {
				deleteMutation.mutateAsync({ id }).catch((e) => {
					console.error('Delete failed', e)
				})
				configureRemoteConnection(null)
			}
		)
	}, [deleteMutation, deleteModalRef, id, remoteConnection, configureRemoteConnection])

	const isEnabled = remoteConnection.enabled === undefined || remoteConnection.enabled
	const doToggleEnabled = useCallback(() => {
		setEnabledMutation.mutateAsync({ id, enabled: !isEnabled }).catch((e) => {
			console.error('Set enabled failed', e)
		})
	}, [setEnabledMutation, id, isEnabled])

	const editClickId = isSelected ? null : id // If this row is selected, don't allow editing on click, as it will close the selection
	const doEdit = useCallback(() => configureRemoteConnection(editClickId), [configureRemoteConnection, editClickId])

	let surfaceInstanceDisplayName = 'Unknown Surface Integration'
	if (remoteConnection.type === 'plugin') {
		const instanceInfo = surfaceInstances.instances.get(remoteConnection.instanceId)

		if (instanceInfo) surfaceInstanceDisplayName = instanceInfo.label
	} else {
		surfaceInstanceDisplayName = 'IP Stream Deck'
	}

	return (
		<div className="flex flex-row align-items-center gap-2 hand">
			<div onClick={doEdit} className="flex flex-column grow" style={{ minWidth: 0 }}>
				<b>{remoteConnection.displayName}</b>
				<span className="auto-ellipsis" title={surfaceInstanceDisplayName}>
					{surfaceInstanceDisplayName}
				</span>
			</div>

			<div className="flex align-items-center">
				<CFormSwitch
					className="ms-2"
					// disabled={!moduleInfo || !moduleVersion}
					color="success"
					checked={isEnabled}
					onChange={doToggleEnabled}
					size="xl"
					title={isEnabled ? `Disable surface connection` : `Enable surface connection`}
				/>

				<CButton onClick={doDelete} title="Delete" className="p-1">
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
			</div>
		</div>
	)
})
