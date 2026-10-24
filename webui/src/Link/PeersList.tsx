import { faPlus, faServer } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { LINK_PERMISSION_DEFINITIONS, type LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { LinkButton } from '~/Components/Button.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { StatusBadge } from '~/Components/StatusBadge.js'
import { useActivateOnKey } from '~/Hooks/useActivateOnKey.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { PeerStatusBadge } from './LinkStatusBadges.js'

/**
 * This installation, then the others discovered on any transport. Selecting one opens what other installations see
 * of this one, or what is shared with it
 */
export const PeersList = observer(function PeersList({
	selectedPeerId,
	selfSelected,
}: {
	selectedPeerId: string | null
	selfSelected: boolean
}): React.JSX.Element {
	const { link: linkStore } = useContext(RootAppStoreContext)
	const peers = linkStore.sortedPeers

	return (
		<>
			<SelfRow isSelected={selfSelected} />
			{peers.length === 0 ? (
				<NoPeers />
			) : (
				peers.map((peer) => <PeerRow key={peer.id} peer={peer} isSelected={peer.id === selectedPeerId} />)
			)}
		</>
	)
})

function NoPeers() {
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

const SharedLinkIdBadge = (
	<StatusBadge tone="warning" title="More than one installation is using this Link id">
		Shared Link id
	</StatusBadge>
)

const SelfRow = observer(function SelfRow({ isSelected }: { isSelected: boolean }) {
	const { link: linkStore } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const doSelect = useCallback(() => {
		void navigate({ to: isSelected ? '/link' : '/link/self' })
	}, [navigate, isSelected])

	return (
		<SelectableRow isSelected={isSelected} doSelect={doSelect}>
			<div className="flex flex-col grow min-w-0">
				<b className="truncate">This installation</b>
				<span className="truncate text-muted text-sm">
					{linkStore.self?.name ?? '…'} · Link id {linkStore.self?.fingerprint ?? '…'}
				</span>
			</div>

			{linkStore.self?.sharesLinkId && SharedLinkIdBadge}
		</SelectableRow>
	)
})

const PeerRow = observer(function PeerRow({ peer, isSelected }: { peer: LinkPeerInfo; isSelected: boolean }) {
	const { link: linkStore } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const doSelect = useCallback(() => {
		void navigate(isSelected ? { to: '/link' } : { to: '/link/$peerId', params: { peerId: peer.id } })
	}, [navigate, isSelected, peer.id])

	return (
		<SelectableRow isSelected={isSelected} doSelect={doSelect}>
			<div className="flex flex-col grow min-w-0">
				<b className="truncate">{peer.name}</b>
				<span className="truncate text-muted text-sm">
					Companion {peer.companionVersion} · {describeSharing(peer)}
				</span>
			</div>

			{peer.sharesLinkId && SharedLinkIdBadge}
			<PeerStatusBadge peer={peer} ourProtocolVersions={linkStore.self?.protocolVersions} />
		</SelectableRow>
	)
})

function SelectableRow({
	isSelected,
	doSelect,
	children,
}: {
	isSelected: boolean
	doSelect: () => void
	children: React.ReactNode
}) {
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
			{children}
		</div>
	)
}

/** How much is shared in each direction, in a few words */
function describeSharing(peer: LinkPeerInfo): string {
	const ours = LINK_PERMISSION_DEFINITIONS.filter((p) => peer.sharedByUs[p.id]).length
	const theirs = LINK_PERMISSION_DEFINITIONS.filter((p) => peer.sharedWithUs?.[p.id]).length
	if (!ours && !theirs) return 'Nothing shared'
	return `We share ${ours} · They share ${theirs}`
}
