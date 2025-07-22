import React, { useCallback, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { OutboundSurfacesTable } from './OutboundSurfacesTable.js'
import { faAdd } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AddOutboundSurfaceModal, AddOutboundSurfaceModalRef } from './AddOutboundSurfaceModal.js'

export function OutboundSurfacesPage(): React.JSX.Element {
	const addModalRef = useRef<AddOutboundSurfaceModalRef>(null)

	const addSurface = useCallback(() => addModalRef?.current?.show(), [])

	return (
		<CRow>
			<CCol xs={12} className="flex-column-layout">
				<div className="fixed-header">
					<h4>Remote Surfaces</h4>

					<p style={{ marginBottom: '0.5rem' }}>
						The Stream Deck Studio and Network Dock support network connections. You can set up the connection from
						Companion here, or use the Discovered Surfaces tab.
						<br />
						This is not suitable for all remote surfaces such as Satellite, as that opens the connection to Companion
						itself.
					</p>

					<AddOutboundSurfaceModal ref={addModalRef} />

					<CButtonGroup size="sm">
						<CButton color="primary" onClick={addSurface}>
							<FontAwesomeIcon icon={faAdd} /> Add Remote Surface
						</CButton>
					</CButtonGroup>
				</div>

				<div className="scrollable-content mt-2">
					<OutboundSurfacesTable />
				</div>
			</CCol>
		</CRow>
	)
}
