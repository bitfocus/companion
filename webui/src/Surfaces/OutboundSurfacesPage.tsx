import React from 'react'
import { CCol, CRow } from '@coreui/react'
import { OutboundSurfacesTable } from './OutboundSurfacesTable.js'

export function OutboundSurfacesPage(): React.JSX.Element {
	return (
		<CRow>
			<CCol xs={12}>
				<h4>Remote Surfaces</h4>

				<p style={{ marginBottom: '0.5rem' }}>
					The Stream Deck Studio and Network Dock support network connections. You can set up the connection from
					Companion here, or use the Discovered Surfaces tab.
					<br />
					This is not suitable for all remote surfaces such as Satellite, as that opens the connection to Companion
					itself.
				</p>

				<OutboundSurfacesTable />
			</CCol>
		</CRow>
	)
}
