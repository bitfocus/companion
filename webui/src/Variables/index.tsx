import React, { useContext } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { VariablesTable } from '~/Components/VariablesTable.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { Link, useParams } from '@tanstack/react-router'
import { useSortedConnectionsThatHaveVariables } from '~/Stores/Util.js'

export const ConnectionVariablesPage = observer(function VariablesConnectionList() {
	const { modules } = useContext(RootAppStoreContext)

	const sortedConnections = useSortedConnectionsThatHaveVariables()

	return (
		<CRow>
			<CCol xs={12} className="flex-column-layout">
				<div className="fixed-header">
					<h4>Variables</h4>
					<p>
						We use variables as placeholders in text, allowing dynamic updates based on the provided content. This
						enables live updating of messages, making customization quick and easy.
					</p>
				</div>

				<div className="scrollable-content">
					<div className="variables-category-grid">
						<CButton color="primary" as={Link} to="/variables/custom">
							Custom Variables
						</CButton>
						<CButton color="primary" as={Link} to="/variables/internal">
							Internal
						</CButton>
						{sortedConnections.map((connectionInfo) => {
							const compactName = modules.getModuleFriendlyName(connectionInfo.instance_type)

							return (
								<CButton key={connectionInfo.id} color="primary" as={Link} to={`/variables/${connectionInfo.label}`}>
									<h6>{connectionInfo?.label ?? '?'}</h6> <small>{compactName ?? '?'}</small>
								</CButton>
							)
						})}
					</div>
				</div>
			</CCol>
		</CRow>
	)
})

export function VariablesListPage(): React.JSX.Element {
	const { label } = useParams({ from: '/_app/variables/$label' })

	// Future: if label is not found, redirect to /variables
	// 	throw redirect({ to: '/variables' })

	return (
		<div className="variables-panel">
			<div>
				<h4 style={{ marginBottom: '0.8rem' }}>Variables</h4>
				<CButtonGroup size="sm">
					<CButton color="primary" as={Link} to="/variables">
						<FontAwesomeIcon icon={faArrowLeft} />
						&nbsp; Go back
					</CButton>
					<CButton color="secondary" disabled>
						{label}
					</CButton>
				</CButtonGroup>
			</div>

			<VariablesTable label={label} />
			<br style={{ clear: 'both' }} />
		</div>
	)
}
