import React, { useCallback, useContext } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { VariablesTable } from '~/Components/VariablesTable.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { CollapsibleTree, CollapsibleTreeNesting, type CollapsibleTreeNode } from '~/Components/CollapsibleTree.js'
import { useCollapsibleTreeExpansion } from '~/Components/useCollapsibleTreeExpansion.js'
import { useConnectionTreeNodes, type ConnectionTreeLeaf } from '~/Components/useConnectionTreeNodes.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

export const ConnectionVariablesPage = observer(function VariablesConnectionList() {
	const { variablesStore } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const filterConnection = useCallback(
		(_connectionId: string, connectionInfo: ClientConnectionConfig) => {
			const connectionVariables = variablesStore.variables.get(connectionInfo.label)
			return !!connectionVariables && connectionVariables.size > 0
		},
		[variablesStore.variables]
	)

	const { nodes, ungroupedLeafs } = useConnectionTreeNodes(filterConnection)
	const collectionExpansion = useCollapsibleTreeExpansion(false)

	// Check if internal has variables
	const internalVariables = variablesStore.variables.get('internal')
	const hasInternalVariables = !!internalVariables && internalVariables.size > 0

	const renderGroupHeader = useCallback((node: CollapsibleTreeNode<ConnectionTreeLeaf>) => {
		return <span>{node.label ?? node.id}</span>
	}, [])

	const renderLeaf = useCallback(
		(leaf: ConnectionTreeLeaf, nestingLevel: number) => {
			return (
				<div className="collapsible-tree-leaf-row" key={leaf.connectionId}>
					<CollapsibleTreeNesting nestingLevel={nestingLevel}>
						<CButton
							color="primary"
							className="w-100 text-start"
							onClick={() => navigate({ to: `/variables/connection/${leaf.connectionLabel}` })}
						>
							<h6 className="mb-0">{leaf.connectionLabel}</h6>
							{leaf.moduleDisplayName && <small>{leaf.moduleDisplayName}</small>}
						</CButton>
					</CollapsibleTreeNesting>
				</div>
			)
		},
		[navigate]
	)

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

					{hasInternalVariables && (
						<div className="mb-2">
							<CButton color="primary" as={Link} to="/variables/connection/internal" className="w-100 text-start">
								<h6 className="mb-0">Internal</h6>
							</CButton>
						</div>
					)}

					<CollapsibleTree
						nodes={nodes}
						ungroupedLeafs={ungroupedLeafs}
						ungroupedLabel="Ungrouped Connections"
						expandedNodeIds={collectionExpansion.expandedNodeIds}
						toggleNodeExpanded={collectionExpansion.toggleNodeExpanded}
						renderGroupHeader={renderGroupHeader}
						renderLeaf={renderLeaf}
					/>
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
