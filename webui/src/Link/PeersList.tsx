import { faPlus, faServer } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { LINK_PERMISSION_DEFINITIONS, type LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { LinkButton } from '~/Components/Button.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { useActivateOnKey } from '~/Hooks/useActivateOnKey.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { PeerStatusBadge } from './LinkStatusBadges.js'

/** The other installations discovered on any transport. Selecting one opens what is shared with it */
export const PeersList = observer(function PeersList({
	selectedPeerId,
}: {
	selectedPeerId: string | null
}): React.JSX.Element {
	const { link: linkStore } = useContext(RootAppStoreContext)
	const peers = linkStore.sortedPeers

	if (peers.length === 0) {
		return (
			<NonIdealState icon={faServer}>
				<p className="my-2 text-sm text-muted">
					No other installations found yet. They appear here once they are reachable on one of the transports: add a
					Direct connection to one, or pair one that connects to this one.
				</p>
				<div className="flex flex-wrap justify-center gap-2 mt-2">
					<LinkButton to="/link/transports/add" color="primary" size="sm">
						<FontAwesomeIcon icon={faPlus} className="me-1.5" /> Add Transport
					</LinkButton>
					<LinkButton to="/link/transports" variant="outline" size="sm">
						Transports
					</LinkButton>
				</div>
			</NonIdealState>
		)
	}

	return (
		<>
			{peers.map((peer) => (
				<PeerRow key={peer.id} peer={peer} isSelected={peer.id === selectedPeerId} />
			))}
		</>
	)
})

const PeerRow = observer(function PeerRow({ peer, isSelected }: { peer: LinkPeerInfo; isSelected: boolean }) {
	const { link: linkStore } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const doSelect = useCallback(() => {
		void navigate(isSelected ? { to: '/link' } : { to: '/link/$peerId', params: { peerId: peer.id } })
	}, [navigate, isSelected, peer.id])
	const doSelectKey = useActivateOnKey(doSelect)

	return (
		<div
			role="button"
			tabIndex={0}
			aria-pressed={isSelected}
			className={classNames(
				'list-row flex flex-row items-center gap-2 py-2 pe-3',
				isSelected ? 'list-row-selected' : 'hover:bg-surface-muted/60'
			)}
			onClick={doSelect}
			onKeyDown={doSelectKey}
		>
			<div className="flex flex-col grow min-w-0">
				<b className="truncate">{peer.name}</b>
				<span className="truncate text-muted text-sm">
					Companion {peer.companionVersion} · {describeSharing(peer)}
				</span>
			</div>

			<PeerStatusBadge peer={peer} ourProtocolVersions={linkStore.self?.protocolVersions} />
		</div>
	)
})

/** How much is shared in each direction, in a few words */
function describeSharing(peer: LinkPeerInfo): string {
	const ours = LINK_PERMISSION_DEFINITIONS.filter((p) => peer.sharedByUs[p.id]).length
	const theirs = LINK_PERMISSION_DEFINITIONS.filter((p) => peer.sharedWithUs?.[p.id]).length
	if (!ours && !theirs) return 'Nothing shared'
	return `We share ${ours} · They share ${theirs}`
}
