import React, { useCallback, useContext, useRef } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faSearch, faTrash } from '@fortawesome/free-solid-svg-icons'
import { CButton, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

export const OutboundSurfacesTable = observer(function OutboundSurfacesTable() {
	const { surfaces } = useContext(RootAppStoreContext)

	const surfacesList = Array.from(surfaces.outboundSurfaces.values()).sort((a, b) => {
		return a.address.localeCompare(b.address)
	})

	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const removeMutation = useMutationExt(trpc.surfaces.outbound.remove.mutationOptions())
	const removeSurface = useCallback(
		(surfaceId: string) => {
			confirmRef.current?.show('Remove Surface', 'Are you sure you want to remove this surface?', 'Remove', () => {
				removeMutation.mutateAsync({ id: surfaceId }).catch((err) => {
					console.error('Remove failed', err)
				})
			})
		},
		[removeMutation]
	)

	const updateNameMutation = useMutationExt(trpc.surfaces.outbound.setName.mutationOptions())
	const updateName = useCallback(
		(surfaceId: string, name: string) => {
			updateNameMutation.mutateAsync({ id: surfaceId, name }).catch((err) => {
				console.error('Update name failed', err)
			})
		},
		[updateNameMutation]
	)

	const updateEnabledMutation = useMutationExt(trpc.surfaces.outbound.setEnabled.mutationOptions())
	const updateEnabled = useCallback(
		(surfaceId: string, enabled: boolean) => {
			updateEnabledMutation.mutateAsync({ id: surfaceId, enabled }).catch((err) => {
				console.error('Update enabled failed', err)
			})
		},
		[updateEnabledMutation]
	)

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>Name</th>
						<th>Type</th>
						<th>Location</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{surfacesList.map((surfaceInfo) => (
						<OutboundSurfaceRow
							key={surfaceInfo.id}
							surfaceInfo={surfaceInfo}
							updateName={updateName}
							updateEnabled={updateEnabled}
							removeSurface={removeSurface}
						/>
					))}

					{surfacesList.length === 0 && (
						<tr>
							<td colSpan={7}>
								<NonIdealState icon={faSearch} text="No remote surfaces are configured" />
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	)
})

interface OutboundSurfaceRowProps {
	surfaceInfo: OutboundSurfaceInfo

	updateName: (surfaceId: string, name: string) => void
	updateEnabled: (surfaceId: string, enabled: boolean) => void
	removeSurface: (surfaceId: string) => void
}
function OutboundSurfaceRow({ surfaceInfo, updateName, updateEnabled, removeSurface }: OutboundSurfaceRowProps) {
	const updateName2 = useCallback((val: string) => updateName(surfaceInfo.id, val), [updateName, surfaceInfo.id])
	const updateEnabled2 = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => updateEnabled(surfaceInfo.id, e.target.checked),
		[updateEnabled, surfaceInfo.id]
	)
	const removeSurface2 = useCallback(() => removeSurface(surfaceInfo.id), [removeSurface, surfaceInfo.id])

	return (
		<tr>
			<td>
				<TextInputField value={surfaceInfo.displayName} setValue={updateName2} />
			</td>
			<td>
				IP Stream Deck
				{/* {surfaceInfo.type} TODO - do this dynamically once there are multiple to support */}
			</td>
			<td>
				{surfaceInfo.address}
				{surfaceInfo.port != null ? `:${surfaceInfo.port}` : ''}
			</td>
			<td className="text-right compact ">
				<div className="flex flex-col align-items-center">
					<CFormSwitch
						color="success"
						className="mb-0 mt-1"
						checked={surfaceInfo.enabled}
						title={surfaceInfo.enabled ? 'Disable connection' : 'Enable connection'}
						onChange={updateEnabled2}
					/>

					<CButton onClick={removeSurface2} title="Remove">
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</div>
			</td>
		</tr>
	)
}
