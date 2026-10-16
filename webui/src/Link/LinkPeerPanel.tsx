import { faServer, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useId } from 'react'
import { LINK_PERMISSION_DEFINITIONS, type LinkPeerInfo, type LinkUsage } from '@companion-app/shared/Model/Link.js'
import { Button } from '~/Components/Button.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { FormLabel } from '~/Components/Form.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { ConfigFieldRow } from '~/UserConfig/Components/ConfigFieldRows.js'
import { PeerStatusBadge } from './LinkStatusBadges.js'
import { useLinkStore } from './LinkStoreContext.js'
import './LinkPeerPanel.css'

/** How often the usage counts are refreshed while the panel is open */
const USAGE_REFRESH_MS = 5000

/** Another installation: how it is reached, what is shared each way, and how much of that is in use */
export const LinkPeerPanel = observer(function LinkPeerPanel({ peer }: { peer: LinkPeerInfo }): React.JSX.Element {
	const navigate = useNavigate()
	const doClose = useCallback(() => void navigate({ to: '/link' }), [navigate])

	return (
		<>
			<PanelHeader icon={faServer} title={peer.name}>
				<CloseButton closeFn={doClose} />
			</PanelHeader>

			<div className="edit-panel flex flex-col flex-1 min-h-0 overflow-hidden">
				<div className="page-scroll edit-panel-scroll">
					<PeerStatusSection peer={peer} />
					<PeerSharingSection peer={peer} />
					<PeerForgetSection peer={peer} doClose={doClose} />
				</div>
			</div>
		</>
	)
})

const PeerStatusSection = observer(function PeerStatusSection({ peer }: { peer: LinkPeerInfo }) {
	const linkStore = useLinkStore()

	return (
		<EditSectionCard
			title="Status"
			summary={<PeerStatusBadge peer={peer} ourProtocolVersions={linkStore.self?.protocolVersions} />}
		>
			<ConfigFieldRow label="Link id" htmlFor={null} help={null}>
				<span className="font-mono" title={peer.id}>
					{peer.fingerprint}
				</span>
			</ConfigFieldRow>
			<ConfigFieldRow label="Companion" htmlFor={null} help={null}>
				{/* The protocol only matters when it is incompatible, which the status badge explains */}
				<span title={`Link protocol ${peer.protocolVersion ?? peer.protocolVersions.join(', ')}`}>
					{peer.companionVersion}
				</span>
			</ConfigFieldRow>
			{peer.routes.length > 0 ? (
				<ConfigFieldRow label="Reachable on" htmlFor={null} help={null}>
					<div className="flex flex-col min-w-0">
						{peer.routes.map(({ transportId, latencyMs }) => (
							<span key={transportId} className="truncate">
								<Link to="/link/transports/$transportId" params={{ transportId }}>
									{linkStore.transports.get(transportId)?.label ?? transportId}
								</Link>
								<span className="text-muted">
									{latencyMs === null ? '' : ` · ${Math.round(latencyMs)} ms round trip`}
								</span>
							</span>
						))}
					</div>
				</ConfigFieldRow>
			) : (
				<ConfigFieldRow label="Last seen" htmlFor={null} help={null}>
					{new Date(peer.lastSeen).toLocaleString()}
				</ConfigFieldRow>
			)}
		</EditSectionCard>
	)
})

/**
 * What is shared each way, one row per thing that can be shared: what we let it use (chosen here) and what it lets us
 * use (chosen over there), each with how much of it is in use
 */
const PeerSharingSection = observer(function PeerSharingSection({ peer }: { peer: LinkPeerInfo }) {
	const usage = useQuery(
		trpc.link.peerUsage.queryOptions({ peerId: peer.id }, { refetchInterval: USAGE_REFRESH_MS })
	).data

	return (
		<EditSectionCard title="Sharing">
			<div className="link-sharing-table">
				<span />
				<span className="link-sharing-head">We share</span>
				<span className="link-sharing-head">{peer.name} shares</span>

				{LINK_PERMISSION_DEFINITIONS.map((permission) => (
					<PeerSharingRow
						key={permission.id}
						peer={peer}
						permission={permission}
						usage={usage?.[permission.id] ?? null}
					/>
				))}
			</div>
		</EditSectionCard>
	)
})

const PeerSharingRow = observer(function PeerSharingRow({
	peer,
	permission,
	usage,
}: {
	peer: LinkPeerInfo
	permission: (typeof LINK_PERMISSION_DEFINITIONS)[number]
	usage: LinkUsage | null
}) {
	const switchId = useId()
	const permissionsMutation = useMutationExt(trpc.link.setPeerPermissions.mutationOptions())

	const doSetShared = useCallback(
		(shared: boolean) => {
			permissionsMutation
				.mutateAsync({ peerId: peer.id, permissions: { ...peer.sharedByUs, [permission.id]: shared } })
				.catch((e) => {
					console.error('Failed to change what is shared', e)
				})
		},
		[permissionsMutation, peer.id, peer.sharedByUs, permission.id]
	)

	const ours = peer.sharedByUs[permission.id]
	const theirs = peer.sharedWithUs?.[permission.id] ?? null

	return (
		<>
			<FormLabel htmlFor={switchId} className="link-sharing-label" title={permission.description}>
				{permission.label}
			</FormLabel>
			<span className="link-sharing-cell">
				<SwitchInputField id={switchId} value={ours} setValue={doSetShared} tooltip={undefined} />
				{ours && usage && <span className="text-muted">{usage.oursUsedThere} in use</span>}
			</span>
			<span className="link-sharing-cell">
				{theirs === null ? (
					<span className="text-muted">Unknown</span>
				) : theirs ? (
					<>
						Yes
						{usage && <span className="text-muted">{usage.theirsUsedHere} in use</span>}
					</>
				) : (
					<span className="text-muted">No</span>
				)}
			</span>
		</>
	)
})

const PeerForgetSection = observer(function PeerForgetSection({
	peer,
	doClose,
}: {
	peer: LinkPeerInfo
	doClose: () => void
}) {
	const forgetMutation = useMutationExt(trpc.link.forgetPeer.mutationOptions())

	const doForget = useCallback(() => {
		forgetMutation
			.mutateAsync({ peerId: peer.id })
			.then(doClose)
			.catch((e) => {
				console.error('Failed to forget installation', e)
			})
	}, [forgetMutation, peer.id, doClose])

	return (
		<EditSectionCard title="Forget" danger>
			<p className="text-sm text-muted mb-0">
				{peer.online
					? 'It can only be forgotten once it is offline, as it would reappear straight away.'
					: 'Remove it from the list. It reappears if it is reachable again. What is shared with it is kept.'}
			</p>
			<div>
				<Button color="danger" variant="outline" size="sm" onClick={doForget} disabled={peer.online}>
					<FontAwesomeIcon icon={faTrash} className="me-1" /> Forget installation
				</Button>
			</div>
		</EditSectionCard>
	)
})
