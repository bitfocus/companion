import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { whyLinkPeerUnusable } from '~/Buttons/EditButton/LinkPeerChoices.js'
import { CollapsibleTree, type CollapsibleTreeLeafProps } from '~/Components/CollapsibleTree/CollapsibleTree.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface InstallationLeaf {
	key: string
	peer: LinkPeerInfo
	why: string | null
	disabled: boolean
}

/**
 * The other Companion installations, whose buttons can be placed as remote buttons. Ones that can't be used now are
 * listed with why, so that it is clear where they went
 */
export const LinkPresetsInstallationList = observer(function LinkPresetsInstallationList({
	setPeerId,
}: {
	setPeerId: (peerId: string) => void
}): React.JSX.Element | null {
	const { link } = useContext(RootAppStoreContext)
	const leaves = link.sortedPeers.map((peer): InstallationLeaf => {
		const why = whyLinkPeerUnusable(peer)
		return { key: peer.id, peer, why, disabled: !!why }
	})
	if (leaves.length === 0) return null

	return (
		<>
			<div className="presets-list-heading">Other installations</div>
			<CollapsibleTree
				className="presets-connection-tree"
				nodes={[]}
				ungroupedLeaves={leaves}
				collapseHelper={null}
				selectedLeafKey={null}
				HeaderComponent={NoHeader}
				LeafComponent={InstallationLeafRow}
				onLeafClick={(leaf) => setPeerId(leaf.peer.id)}
			/>
		</>
	)
})

/** The list has no groups, so no headers */
function NoHeader() {
	return null
}

function InstallationLeafRow({ leaf }: CollapsibleTreeLeafProps<InstallationLeaf>) {
	return (
		<>
			<div className="collapsible-tree-leaf-text presets-connection-leaf">
				<div className="presets-connection-name">
					<span className="collapsible-tree-connection-label">{leaf.peer.name}</span>
					<small>{leaf.why ?? leaf.peer.fingerprint}</small>
				</div>
			</div>
			{!leaf.disabled && <FontAwesomeIcon icon={faArrowRight} className="collapsible-tree-leaf-arrow-icon" />}
		</>
	)
}
