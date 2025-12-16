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
						Variables are dynamic placeholders that can be used in text, actions, and feedbacks. They automatically
						update with live content, making it easy to create customized and responsive displays.
					</p>
				</div>

				<div className="scrollable-content">
					<div className="variables-category-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
						<CButton color="info" as={Link} to="/variables/custom" className="mb-3">
							<h6 className="mb-0 py-1">Custom Variables</h6>
						</CButton>
						<CButton color="info" as={Link} to="/variables/expression" className="mb-3">
							<h6 className="mb-0 py-1">Expression Variables</h6>
						</CButton>
					</div>

					<div className="variables-category-grid">
						<CButton color="primary" as={Link} to="/variables/connection/internal">
							Internal
						</CButton>
						{sortedConnections.map((connectionInfo) => {
							const compactName = modules.getModuleFriendlyName(connectionInfo.moduleType, connectionInfo.moduleId)

							return (
								<CButton
									key={connectionInfo.id}
									color="primary"
									as={Link}
									to={`/variables/connection/${connectionInfo.label}`}
								>
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
	const { label } = useParams({ from: '/_app/variables/connection/$label' })

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
