import { faArrowRight, faDollarSign, faList } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import './variables-category-grid.css'
import { observer } from 'mobx-react-lite'
import { memo, useCallback, useContext, useState } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { CollapsibleTree, type CollapsibleTreeHeaderProps } from '~/Components/CollapsibleTree/CollapsibleTree.js'
import {
	useConnectionLeafTree,
	type CollectionGroupMeta,
	type ConnectionLeafItem,
} from '~/Components/CollapsibleTree/useConnectionLeafTree.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { VariablesTable } from '~/Components/VariablesTable.js'
import { usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import { PageHeader } from '~/Layout/PageHeader'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { useComputed } from '~/Resources/util.js'
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
	const { variablesStore, connections } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const [filter, setFilter] = useState('')

	let filterRegexp: RegExp | null = null
	if (filter) {
		try {
			filterRegexp = new RegExp(filter, 'i')
		} catch (e) {
			console.error('Failed to compile filter regexp:', e)
		}
	}

	const filterConnection = useCallback(
		(_connectionId: string, connectionInfo: ClientConnectionConfig) => {
			const connectionVariables = variablesStore.variables.get(connectionInfo.label)
			if (!connectionVariables || connectionVariables.size === 0) return false
			return !filterRegexp || filterRegexp.test(connectionInfo.label)
		},
		[variablesStore.variables, filterRegexp]
	)

	const { nodes, ungroupedLeaves, allNodeIds } = useConnectionLeafTree(filterConnection)
	const collapseHelper = usePanelCollapseHelper('variables-connections', allNodeIds)

	// Check if internal has variables
	const internalVariables = variablesStore.variables.get('internal')
	const hasInternalVariables = !!internalVariables && internalVariables.size > 0

	const staticLeaves: ConnectionLeafItem[] =
		hasInternalVariables && (!filterRegexp || filterRegexp.test('internal'))
			? [
					{
						key: 'internal',
						connectionId: 'internal',
						connectionLabel: 'internal',
						moduleDisplayName: 'Internal',
					},
				]
			: []

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/variables/connection/$label' })
	const selectedLabel = routeMatch ? routeMatch.label : null

	// Leaves are keyed by connection id, but the route (and the variables) use the label
	const selectedLeafKey = useComputed(() => {
		if (!selectedLabel) return null
		if (selectedLabel === 'internal') return 'internal'
		for (const [connectionId, connectionInfo] of connections.connections) {
			if (connectionInfo.label === selectedLabel) return connectionId
		}
		return null
	}, [connections.connections, selectedLabel])

	const doClose = useCallback(() => {
		void navigate({ to: '/variables' })
	}, [navigate])

	return (
		<div className="page-shell">
			<PageHeader icon={faDollarSign} title="Connection Variables" helpAction="/user-guide/config/variables" />

			<VariablesNav activeTab="connections" />

			<SplitPanels.Root
				showing={selectedLabel ? 'secondary' : 'primary'}
				resize={{ storageKey: 'connection-variables' }}
			>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						{/* Top Header Card: Search */}
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
							<p className="text-xs text-muted mb-0">
								Select an active connection below to browse its available variables and their current values.
							</p>

							<SearchBox
								placeholder="Search connections..."
								filter={filter}
								setFilter={setFilter}
								className="w-full h-9"
							/>
						</div>

						<div className="flex-1 min-h-0 scrollable-content list-card">
							<CollapsibleTree
								nodes={nodes}
								staticLeaves={staticLeaves}
								ungroupedLeaves={ungroupedLeaves}
								ungroupedLabel="Ungrouped Connections"
								collapseHelper={filter ? null : collapseHelper}
								selectedLeafKey={selectedLeafKey}
								HeaderComponent={VariableGroupHeader}
								LeafComponent={VariableLeaf}
								noContent={<NonIdealState icon={faList} text="No connections with variables" />}
								onLeafClick={(leaf) =>
									void navigate({ to: '/variables/connection/$label', params: { label: leaf.connectionLabel } })
								}
							/>
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{!!selectedLabel && <ConnectionVariablesPanelHeading label={selectedLabel} doClose={doClose} />}
						<Outlet />
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

interface ConnectionVariablesPanelHeadingProps {
	label: string
	doClose: () => void
}

function ConnectionVariablesPanelHeading({ label, doClose }: ConnectionVariablesPanelHeadingProps) {
	return (
		<div className="flex items-center justify-between gap-3 p-3 bg-surface-muted/40 border-b border-border/70 shrink-0">
			<div className="flex items-center gap-2 min-w-0">
				<span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-muted text-muted text-xs shrink-0">
					<FontAwesomeIcon icon={faDollarSign} />
				</span>
				<h3 className="text-sm font-bold text-body mb-0 truncate">{label}</h3>
			</div>
			<div className="flex items-center gap-1.5">
				<ContextHelpButton action="/user-guide/config/variables" />
				<CloseButton closeFn={doClose} />
			</div>
		</div>
	)
}

export function ConnectionVariablesPanel({ label }: { label: string }): React.JSX.Element {
	return (
		<div className="secondary-panel-simple-body variables-panel">
			<VariablesTable label={label} />
		</div>
	)
}
