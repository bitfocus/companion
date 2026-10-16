import { faServer } from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { PeerStatusBadge } from './LinkStatusBadges.js'
import { useLinkStore } from './LinkStoreContext.js'

/** The other installations discovered on any transport. Selecting one opens what is shared with it */
export const PeersList = observer(function PeersList({
	selectedPeerId,
}: {
	selectedPeerId: string | null
}): React.JSX.Element {
	const linkStore = useLinkStore()
	const peers = linkStore.sortedPeers

	if (peers.length === 0) {
		return (
			<NonIdealState icon={faServer}>
				No other installations found yet. They appear here once they are reachable on one of the transports.
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
	const linkStore = useLinkStore()
	const navigate = useNavigate()

	const doSelect = useCallback(() => {
		void navigate(isSelected ? { to: '/link' } : { to: '/link/$peerId', params: { peerId: peer.id } })
	}, [navigate, isSelected, peer.id])

	return (
		<div
			className={classNames(
				'list-row flex flex-row items-center gap-2 py-2 pe-3',
				isSelected ? 'list-row-selected' : 'hover:bg-surface-muted/60'
			)}
			onClick={doSelect}
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

/** What is shared in each direction, in a few words */
function describeSharing(peer: LinkPeerInfo): string {
	const ours = peer.sharedByUs.buttons
	const theirs = peer.sharedWithUs?.buttons ?? false
	if (ours && theirs) return 'Buttons shared both ways'
	if (ours) return 'Our buttons shared with it'
	if (theirs) return 'Its buttons shared with us'
	return 'Nothing shared'
}
