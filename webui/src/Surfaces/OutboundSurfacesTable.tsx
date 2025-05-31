import React, { useCallback, useContext, useRef } from 'react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { NonIdealState } from '../Components/NonIdealState.js'
import { faAdd, faSearch, faTrash } from '@fortawesome/free-solid-svg-icons'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AddOutboundSurfaceModal, AddOutboundSurfaceModalRef } from './AddOutboundSurfaceModal.js'
import { OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { TextInputField } from '../Components/TextInputField.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { observer } from 'mobx-react-lite'

export const OutboundSurfacesTable = observer(function OutboundSurfacesTable() {
	const { surfaces, socket } = useContext(RootAppStoreContext)

	const surfacesList = Array.from(surfaces.outboundSurfaces.values()).sort((a, b) => {
		return a.address.localeCompare(b.address)
	})

	const addModalRef = useRef<AddOutboundSurfaceModalRef>(null)
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const addSurface = useCallback(() => addModalRef?.current?.show(), [])

	const removeSurface = useCallback(
		(surfaceId: string) => {
			confirmRef.current?.show('Remove Surface', 'Are you sure you want to remove this surface?', 'Remove', () => {
				socket.emitPromise('surfaces:outbound:remove', [surfaceId]).catch((err) => {
					console.error('fotget failed', err)
				})
			})
		},
		[socket]
	)

	const updateName = useCallback(
		(surfaceId: string, name: string) => {
			socket.emitPromise('surfaces:outbound:set-name', [surfaceId, name]).catch((err) => {
				console.error('Update name failed', err)
			})
		},
		[socket]
	)

	return (
		<>
			<AddOutboundSurfaceModal ref={addModalRef} />
			<GenericConfirmModal ref={confirmRef} />

			<CButtonGroup size="sm">
				<CButton color="primary" onClick={addSurface}>
					<FontAwesomeIcon icon={faAdd} /> Add Remote Surface
				</CButton>
			</CButtonGroup>

			<table className="table table-responsive-sm table-margin-top">
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
	removeSurface: (surfaceId: string) => void
}
function OutboundSurfaceRow({ surfaceInfo, updateName, removeSurface }: OutboundSurfaceRowProps) {
	const updateName2 = useCallback((val: string) => updateName(surfaceInfo.id, val), [updateName, surfaceInfo.id])
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
			<td className="text-right">
				<CButton onClick={removeSurface2}>
					<FontAwesomeIcon icon={faTrash} /> Remove
				</CButton>
			</td>
		</tr>
	)
}
