import { faArrowRight, faLifeRing } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { createContext, memo, useCallback, useContext } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { CollapsibleTree, type CollapsibleTreeHeaderProps } from '~/Components/CollapsibleTree/CollapsibleTree.js'
import {
	useConnectionLeafTree,
	type CollectionGroupMeta,
	type ConnectionLeafItem,
} from '~/Components/CollapsibleTree/useConnectionLeafTree.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import { useComputed } from '~/Resources/util'
import type { PresetDefinitionsStore } from './PresetDefinitionsStore'

const PresetsStoreContext = createContext<PresetDefinitionsStore | null>(null)

const PresetLeaf = observer(function PresetLeaf({ leaf }: { leaf: ConnectionLeafItem }) {
	const presetsDefinitionsStore = useContext(PresetsStoreContext)

	const connectionPresets = presetsDefinitionsStore?.presets.get(leaf.connectionId)
	const presetCount = useComputed(() => {
		if (!connectionPresets) return 0

		let count = 0

		for (const section of Object.values(connectionPresets.sections)) {
			for (const group of Object.values(section?.definitions ?? {})) {
				switch (group.type) {
					case 'simple':
						count += Object.keys(group.presets).length
						break
					case 'template':
						count += group.templateValues.length
						break
					default:
						assertNever(group)
						break
				}
			}
		}

		return count
	}, [connectionPresets])

	return (
		<>
			<div className="collapsible-tree-leaf-text presets-connection-leaf">
				<div className="presets-connection-name">
					<span className="collapsible-tree-connection-label">{leaf.connectionLabel}</span>
					{leaf.moduleDisplayName && <small>{leaf.moduleDisplayName}</small>}
				</div>
				<span className="presets-connection-count">{presetCount}</span>
			</div>
			<FontAwesomeIcon icon={faArrowRight} className="collapsible-tree-leaf-arrow-icon" />
		</>
	)
})

const PresetGroupHeader = memo(function PresetGroupHeader({
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
			return !!presets && Object.keys(presets.sections).length > 0
		},
		[presetsDefinitionsStore.presets]
	)

	const { nodes, ungroupedLeaves, allNodeIds } = useConnectionLeafTree(filterConnection)
	const collapseHelper = usePanelCollapseHelper('presets-connections', allNodeIds)

	const hasAnyConnections = nodes.length > 0 || ungroupedLeaves.length > 0

	return (
		<PresetsStoreContext.Provider value={presetsDefinitionsStore}>
			<div className="buttons-sidebar-section presets-panel">
				<h5 className="buttons-sidebar-heading">Presets</h5>
				<p className="presets-intro">Choose a connection, then drag a ready-made button onto the grid.</p>
				<div className="presets-list-heading">Available connections</div>

				{!hasAnyConnections ? (
					<div className="presets-empty-state">
						<NonIdealState icon={faLifeRing} text="You have no connections that support presets at the moment." />
					</div>
				) : (
					<CollapsibleTree
						className="presets-connection-tree"
						nodes={nodes}
						ungroupedLeaves={ungroupedLeaves}
						ungroupedLabel="Ungrouped Connections"
						collapseHelper={collapseHelper}
						selectedLeafKey={null}
						HeaderComponent={PresetGroupHeader}
						LeafComponent={PresetLeaf}
						onLeafClick={(leaf) => setConnectionId(leaf.connectionId)}
					/>
				)}

				<p className="presets-footnote">Not every module provides presets. You can also build buttons manually.</p>
			</div>
		</PresetsStoreContext.Provider>
	)
})
