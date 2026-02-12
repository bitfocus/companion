import React, { useCallback, useContext } from 'react'
import { CCallout } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { faLifeRing, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { NonIdealState } from '~/Components/NonIdealState.js'
import type { PresetDefinitionsStore } from './PresetDefinitionsStore'
import { CollapsibleTree, type CollapsibleTreeNode } from '~/Components/CollapsibleTree/CollapsibleTree.js'
import { usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import {
	useConnectionLeafTree,
	type ConnectionLeafItem,
	type CollectionGroupMeta,
} from '~/Components/CollapsibleTree/useConnectionLeafTree.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const PresetsStoreContext = React.createContext<PresetDefinitionsStore | null>(null)

const PresetLeaf = observer(function PresetLeaf({ leaf }: { leaf: ConnectionLeafItem }) {
	const presetsDefinitionsStore = useContext(PresetsStoreContext)
	const presetCount = presetsDefinitionsStore?.presets.get(leaf.connectionId)?.size ?? 0
	const presetLabel = presetCount === 1 ? 'preset' : 'presets'

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
						{presetCount} {presetLabel}
					</small>
				</div>
			</div>
			<FontAwesomeIcon icon={faArrowRight} className="collapsible-tree-leaf-arrow-icon" />
		</>
	)
})

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

	return (
		<PresetsStoreContext.Provider value={presetsDefinitionsStore}>
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
						LeafComponent={PresetLeaf}
						onLeafClick={(leaf) => setConnectionId(leaf.connectionId)}
					/>
				)}

				<CCallout color="warning">
					Not every module provides presets, and you can do a lot more by editing the actions and feedbacks on a button
					manually.
				</CCallout>
			</div>
		</PresetsStoreContext.Provider>
	)
})
