import { CRow, CCol } from '@coreui/react'
import React from 'react'
import { SurfaceDiscoveryTable } from './SurfaceDiscoveryTable'

export function DiscoverSurfacesPage(): React.JSX.Element {
	return (
		<CRow>
			<CCol xs={12}>
				<h4>Discover Surfaces</h4>

				<p style={{ marginBottom: '0.5rem' }}>
					Discovered remote surfaces, such as Companion Satellite, Stream Deck Studio or Stream Deck Network Dock will
					be listed here. You can easily configure them to connect to Companion from here.
					<br />
					This requires Companion Satellite version 1.9.0 and later.
				</p>

				<SurfaceDiscoveryTable />
			</CCol>
		</CRow>
	)
}
