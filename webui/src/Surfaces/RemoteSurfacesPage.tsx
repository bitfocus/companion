import React, { useCallback, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { OutboundSurfacesTable } from './OutboundSurfacesTable.js'
import { faAdd } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AddOutboundSurfaceModal, type AddOutboundSurfaceModalRef } from './AddOutboundSurfaceModal.js'
import { SurfaceDiscoveryTable } from './SurfaceDiscoveryTable.js'
import { MyErrorBoundary } from '~/Resources/Error.js'

export function RemoteSurfacesPage(): React.JSX.Element {
	const addModalRef = useRef<AddOutboundSurfaceModalRef>(null)

	const addSurface = useCallback(() => addModalRef?.current?.show(), [])

	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel flex-column-layout collapse-under-xl">
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
					<MyErrorBoundary>
						<OutboundSurfacesTable />
					</MyErrorBoundary>
				</div>
			</CCol>

			<CCol xl={6} className="secondary-panel">
				<div className="secondary-panel-simple">
					<div className="secondary-panel-simple-header">
						<h4 className="panel-title">Discover Surfaces</h4>
					</div>

					<div className="secondary-panel-simple-body">
						<div className="fixed-header">
							<p style={{ marginBottom: '0.5rem' }}>
								Discovered remote surfaces, such as Companion Satellite, Stream Deck Studio or Stream Deck Network Dock
								will be listed here. You can easily configure them to connect to Companion from here.
								<br />
								This requires Companion Satellite version 1.9.0 and later.
							</p>
						</div>

						<div className="scrollable-content mt-2">
							<MyErrorBoundary>
								<SurfaceDiscoveryTable />
							</MyErrorBoundary>
						</div>
					</div>
				</div>
			</CCol>
		</CRow>
	)
}
