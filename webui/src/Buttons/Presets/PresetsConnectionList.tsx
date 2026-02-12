import React, { useCallback } from 'react'
import { CButton, CCallout } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { faLifeRing } from '@fortawesome/free-solid-svg-icons'
import { NonIdealState } from '~/Components/NonIdealState.js'
import type { PresetDefinitionsStore } from './PresetDefinitionsStore'
import { CollapsibleTree, CollapsibleTreeNesting, type CollapsibleTreeNode } from '~/Components/CollapsibleTree.js'
import { usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import {
	useConnectionLeafTree,
	type ConnectionLeafItem,
	type CollectionGroupMeta,
} from '~/Components/useConnectionLeafTree.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

interface PresetsConnectionListProps {
	presetsDefinitionsStore: PresetDefinitionsStore
	setConnectionId: (connectionId: string) => void
}
export const PresetsConnectionList = observer(function PresetsConnectionList({
	presetsDefinitionsStore,
	setConnectionId,
}: PresetsConnectionListProps) {
	const filterConnection = useCallback(
		(_connectionId: string, _connectionInfo: ClientConnectionConfig) => {
			const presets = presetsDefinitionsStore.presets.get(_connectionId)
			return !!presets && presets.size > 0
		},
		[presetsDefinitionsStore.presets]
	)

	const { nodes, ungroupedLeafs, allNodeIds } = useConnectionLeafTree(filterConnection)
	const collapseHelper = usePanelCollapseHelper('presets-connections', allNodeIds)

	const hasAnyConnections = nodes.length > 0 || ungroupedLeafs.length > 0

	const renderGroupHeader = useCallback((node: CollapsibleTreeNode<ConnectionLeafItem, CollectionGroupMeta>) => {
		return <span>{node.metadata.label}</span>
	}, [])

	const renderLeaf = useCallback(
		(leaf: ConnectionLeafItem, nestingLevel: number) => {
			return (
				<div className="collapsible-tree-leaf-row" key={leaf.connectionId}>
					<CollapsibleTreeNesting nestingLevel={nestingLevel}>
						<CButton
							color="primary"
							className="w-100 text-start"
							title={leaf.moduleDisplayName}
							onClick={() => setConnectionId(leaf.connectionId)}
						>
							<h6 className="mb-0">{leaf.connectionLabel}</h6>
							{leaf.moduleDisplayName && <small>{leaf.moduleDisplayName}</small>}
						</CButton>
					</CollapsibleTreeNesting>
				</div>
			)
		},
		[setConnectionId]
	)

	return (
		<div>
			<h5>Presets</h5>
			<p>
				Ready made buttons with text, actions and feedback which you can drop onto a button to help you get started
				quickly.
			</p>

			{!hasAnyConnections ? (
				<div style={{ border: '1px solid #e9e9e9', borderRadius: 5 }}>
					<NonIdealState icon={faLifeRing} text="You have no connections that support presets at the moment." />
				</div>
			) : (
				<CollapsibleTree
					nodes={nodes}
					ungroupedLeafs={ungroupedLeafs}
					ungroupedLabel="Ungrouped Connections"
					collapseHelper={collapseHelper}
					renderGroupHeader={renderGroupHeader}
					renderLeaf={renderLeaf}
				/>
			)}

			<CCallout color="warning">
				Not every module provides presets, and you can do a lot more by editing the actions and feedbacks on a button
				manually.
			</CCallout>
		</div>
	)
})
