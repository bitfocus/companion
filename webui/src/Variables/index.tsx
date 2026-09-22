import { faArrowLeft, faArrowRight, faDollarSign } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate, useParams } from '@tanstack/react-router'
import './variables-category-grid.css'
import { observer } from 'mobx-react-lite'
import { memo, useCallback, useContext } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { LinkButton } from '~/Components/Button'
import { CollapsibleTree, type CollapsibleTreeHeaderProps } from '~/Components/CollapsibleTree/CollapsibleTree.js'
import {
	useConnectionLeafTree,
	type CollectionGroupMeta,
	type ConnectionLeafItem,
} from '~/Components/CollapsibleTree/useConnectionLeafTree.js'
import { VariablesTable } from '~/Components/VariablesTable.js'
import { usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import { PageHeader } from '~/Layout/PageHeader'
import { PageIntro } from '~/Layout/PageIntro'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { VariablesNav } from './VariablesNav.js'

const VariableLeaf = observer(function VariableLeaf({ leaf }: { leaf: ConnectionLeafItem }) {
	const { variablesStore } = useContext(RootAppStoreContext)
	const variableCount = variablesStore.variables.get(leaf.connectionLabel)?.size ?? 0
	const variableLabel = variableCount === 1 ? 'variable' : 'variables'

	return (
		<>
			<div className="collapsible-tree-leaf-text">
				<div className="flex justify-between items-center w-full">
					<div>
						<span className="collapsible-tree-connection-label">{leaf.connectionLabel}</span>
						{leaf.moduleDisplayName && (
							<>
								<br />
								<small className="opacity-70">{leaf.moduleDisplayName}</small>
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

const VariableGroupHeader = memo(function VariableGroupHeader({
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

	const { nodes, ungroupedLeaves, allNodeIds } = useConnectionLeafTree(filterConnection)
	const collapseHelper = usePanelCollapseHelper('variables-connections', allNodeIds)

	// Check if internal has variables
	const internalVariables = variablesStore.variables.get('internal')
	const hasInternalVariables = !!internalVariables && internalVariables.size > 0

	const staticLeaves: ConnectionLeafItem[] = hasInternalVariables
		? [
				{
					key: 'internal',
					connectionId: 'internal',
					connectionLabel: 'internal',
					moduleDisplayName: 'Internal',
				},
			]
		: []

	return (
		<div className="page-shell">
			<PageHeader icon={faDollarSign} title="Variables" helpAction="/user-guide/config/variables" />

			<div className="page-shell-body">
				<VariablesNav activeTab="connections" />

				<div className="page-scroll">
					<PageIntro title="Connection Variables">
						Select an active connection below to browse its availabe variables and their current values.
					</PageIntro>

					<div className="rounded-lg border border-border/70 bg-surface p-3">
						<CollapsibleTree
							nodes={nodes}
							staticLeaves={staticLeaves}
							ungroupedLeaves={ungroupedLeaves}
							ungroupedLabel="Ungrouped Connections"
							collapseHelper={collapseHelper}
							HeaderComponent={VariableGroupHeader}
							LeafComponent={VariableLeaf}
							onLeafClick={(leaf) => void navigate({ to: `/variables/connection/${leaf.connectionLabel}` })}
						/>
					</div>
				</div>
			</div>
		</div>
	)
})

export function VariablesListPage(): React.JSX.Element {
	const { label } = useParams({ from: '/_app/variables/connection/$label' })

	return (
		<div className="page-shell">
			<PageHeader icon={faDollarSign} title="Variables" helpAction="/user-guide/config/variables" />

			<div className="page-shell-body">
				<div className="flex items-center gap-2 mb-3">
					<LinkButton color="secondary" size="sm" to="/variables">
						<FontAwesomeIcon icon={faArrowLeft} className="me-1.5" /> Back to Variables
					</LinkButton>
					<span className="text-sm font-bold text-body px-2.5 py-1 rounded-md bg-surface-muted border border-border/60">
						{label}
					</span>
				</div>

				<div className="page-scroll rounded-lg border border-border/70 bg-surface p-4">
					<VariablesTable label={label} />
				</div>
			</div>
		</div>
	)
}
