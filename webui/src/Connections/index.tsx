import { CCol, CRow } from '@coreui/react'
import React, { useCallback, useState } from 'react'
import { MyErrorBoundary } from '~/util.js'
import { ConnectionsList } from './ConnectionList/ConnectionList.js'
import { AddConnectionsPanel } from './AddConnectionPanel.js'
import { ConnectionEditPanel } from './ConnectionEdit/ConnectionEditPanel.js'
import { nanoid } from 'nanoid'
import { observer } from 'mobx-react-lite'

export const ConnectionsPage = observer(function ConnectionsPage(): React.JSX.Element {
	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)

	const doConfigureConnection = useCallback((connectionId: string | null) => {
		setSelectedConnectionId(connectionId)
		setTabResetToken(nanoid())
	}, [])

	return (
		<CRow className="connections-page split-panels">
			<CCol xl={6} className="connections-panel primary-panel">
				<ConnectionsList doConfigureConnection={doConfigureConnection} selectedConnectionId={selectedConnectionId} />
			</CCol>

			<CCol xl={6} className="connections-panel secondary-panel">
				<div className="secondary-panel-simple">
					{selectedConnectionId ? (
						<MyErrorBoundary>
							<ConnectionEditPanel
								key={tabResetToken}
								doConfigureConnection={doConfigureConnection}
								connectionId={selectedConnectionId}
							/>
						</MyErrorBoundary>
					) : (
						<MyErrorBoundary>
							<AddConnectionsPanel doConfigureConnection={doConfigureConnection} />
						</MyErrorBoundary>
					)}
				</div>
			</CCol>
		</CRow>
	)
})
