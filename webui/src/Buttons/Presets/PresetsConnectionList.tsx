import React, { useCallback, useContext } from 'react'
import { CCallout } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { faLifeRing, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { NonIdealState } from '~/Components/NonIdealState.js'
import type { PresetDefinitionsStore } from './PresetDefinitionsStore'
import { CollapsibleTree, type CollapsibleTreeHeaderProps } from '~/Components/CollapsibleTree/CollapsibleTree.js'
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
	const presetCount = Object.keys(presetsDefinitionsStore?.presets.get(leaf.connectionId) ?? {}).length
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

const PresetGroupHeader = React.memo(function PresetGroupHeader({
	node,
}: CollapsibleTreeHeaderProps<ConnectionLeafItem, CollectionGroupMeta>) {
	return <span>{node.metadata.label}</span>
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
		(connectionId: string, _connectionInfo: ClientConnectionConfig) => {
			const presets = presetsDefinitionsStore.presets.get(connectionId)
			return !!presets && Object.keys(presets).length > 0
		},
		[presetsDefinitionsStore.presets]
	)

	const { nodes, ungroupedLeaves, allNodeIds } = useConnectionLeafTree(filterConnection)
	const collapseHelper = usePanelCollapseHelper('presets-connections', allNodeIds)

	const hasAnyConnections = nodes.length > 0 || ungroupedLeaves.length > 0

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
						ungroupedLeaves={ungroupedLeaves}
						ungroupedLabel="Ungrouped Connections"
						collapseHelper={collapseHelper}
						HeaderComponent={PresetGroupHeader}
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
