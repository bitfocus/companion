import { faServer, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { Button } from '~/Components/Button.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PeerStatusBadge } from './LinkStatusBadges.js'
import { useLinkStore } from './LinkStoreContext.js'

/** The other installations discovered on any transport */
export const PeersList = observer(function PeersList(): React.JSX.Element {
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
				<PeerRow key={peer.id} peer={peer} />
			))}
		</>
	)
})

const PeerRow = observer(function PeerRow({ peer }: { peer: LinkPeerInfo }) {
	const linkStore = useLinkStore()
	const forgetMutation = useMutationExt(trpc.link.forgetPeer.mutationOptions())

	const doForget = useCallback(() => {
		forgetMutation.mutateAsync({ peerId: peer.id }).catch((e) => {
			console.error('Failed to forget installation', e)
		})
	}, [forgetMutation, peer.id])

	const via = peer.transportIds.map((id) => linkStore.transports.get(id)?.label ?? id).join(', ')

	return (
		<div className="list-row flex flex-row items-center gap-2 py-2 pe-3 cursor-default">
			<div className="flex flex-col grow min-w-0">
				<b className="truncate">{peer.name}</b>
				<span className="truncate text-muted text-sm" title={`Link id: ${peer.id}`}>
					Companion {peer.companionVersion}
					{via ? ` · via ${via}` : ` · last seen ${new Date(peer.lastSeen).toLocaleString()}`}
				</span>
				<span className="truncate text-muted text-xs">{describeSharing(peer)}</span>
			</div>

			<PeerStatusBadge peer={peer} ourProtocolVersion={linkStore.self?.protocolVersion} />

			<div className="flex items-center ps-2">
				<Button
					onClick={doForget}
					title="Forget this installation. It will reappear if it is still reachable"
					className="p-1"
					color="danger"
					variant="ghost"
					disabled={peer.online}
				>
					<FontAwesomeIcon icon={faTrash} />
				</Button>
			</div>
		</div>
	)
})

/** What is shared in each direction, in words */
function describeSharing(peer: LinkPeerInfo): string {
	const ours = peer.sharedByUs.buttons ? 'yes' : 'no'
	const theirs = peer.sharedWithUs === null ? 'unknown' : peer.sharedWithUs.buttons ? 'yes' : 'no'
	return `Buttons shared with it: ${ours} · shared with this installation: ${theirs}`
}
