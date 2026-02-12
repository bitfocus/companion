import React, { useCallback, useContext } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { VariablesTable } from '~/Components/VariablesTable.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { CollapsibleTree, type CollapsibleTreeHeaderProps } from '~/Components/CollapsibleTree/CollapsibleTree.js'
import { usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import {
	useConnectionLeafTree,
	type ConnectionLeafItem,
	type CollectionGroupMeta,
} from '~/Components/CollapsibleTree/useConnectionLeafTree.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

const VariableLeaf = observer(function VariableLeaf({ leaf }: { leaf: ConnectionLeafItem }) {
	const { variablesStore } = useContext(RootAppStoreContext)
	const variableCount = variablesStore.variables.get(leaf.connectionLabel)?.size ?? 0
	const variableLabel = variableCount === 1 ? 'variable' : 'variables'

	return (
		<>
			<div className="collapsible-tree-leaf-text">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
					<div>
						<span className="collapsible-tree-connection-label">{leaf.connectionLabel}</span>
						{leaf.moduleDisplayName && (
							<>
								<br />
								<small style={{ opacity: 0.7 }}>{leaf.moduleDisplayName}</small>
							</>
						)}
					</div>
					<small style={{ opacity: 0.7, marginLeft: '1em' }}>
						{variableCount} {variableLabel}
					</small>
				</div>
			</div>
			<FontAwesomeIcon icon={faArrowRight} className="collapsible-tree-leaf-arrow-icon" />
		</>
	)
})

const VariableGroupHeader = React.memo(function VariableGroupHeader({
	node,
}: CollapsibleTreeHeaderProps<ConnectionLeafItem, CollectionGroupMeta>) {
	return <span>{node.metadata.label}</span>
})

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

	const { nodes, ungroupedLeafs, allNodeIds } = useConnectionLeafTree(filterConnection)
	const collapseHelper = usePanelCollapseHelper('variables-connections', allNodeIds)

	// Check if internal has variables
	const internalVariables = variablesStore.variables.get('internal')
	const hasInternalVariables = !!internalVariables && internalVariables.size > 0

	const staticLeafs: ConnectionLeafItem[] = hasInternalVariables
		? [
				{
					connectionId: 'internal',
					connectionLabel: 'internal',
					moduleDisplayName: 'Internal',
				},
			]
		: []

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

					<CollapsibleTree
						nodes={nodes}
						staticLeafs={staticLeafs}
						ungroupedLeafs={ungroupedLeafs}
						ungroupedLabel="Ungrouped Connections"
						collapseHelper={collapseHelper}
						HeaderComponent={VariableGroupHeader}
						LeafComponent={VariableLeaf}
						onLeafClick={(leaf) => void navigate({ to: `/variables/connection/${leaf.connectionLabel}` })}
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
