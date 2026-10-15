import { observer } from 'mobx-react-lite'
import type { LinkPeerInfo, LinkTransportState } from '@companion-app/shared/Model/Link.js'
import { StatusBadge } from '~/Components/StatusBadge.js'
import { assertNever } from '~/Resources/util.js'

export function TransportStatusBadge({ state }: { state: LinkTransportState | undefined }): React.JSX.Element {
	const status = state?.status ?? 'disabled'
	const title = state?.message ?? undefined

	switch (status) {
		case 'connected':
			// A connected transport can still have something to say, eg an unverified certificate
			return (
				<StatusBadge tone={state?.message ? 'warning' : 'good'} title={title}>
					Connected
				</StatusBadge>
			)
		case 'connecting':
			return (
				<StatusBadge tone="info" title={title}>
					Connecting
				</StatusBadge>
			)
		case 'error':
			return (
				<StatusBadge tone="error" title={title}>
					Error
				</StatusBadge>
			)
		case 'disabled':
			return <StatusBadge tone="disabled">Disabled</StatusBadge>
		default:
			assertNever(status)
			return <StatusBadge tone="neutral">{status}</StatusBadge>
	}
}

export const PeerStatusBadge = observer(function PeerStatusBadge({
	peer,
	ourProtocolVersion,
}: {
	peer: LinkPeerInfo
	ourProtocolVersion: string | undefined
}): React.JSX.Element {
	if (!peer.compatible) {
		return (
			<StatusBadge
				tone="warning"
				title={`It uses Link protocol ${peer.protocolVersion}, which is not compatible with ${ourProtocolVersion ?? 'ours'}. Update Companion on both installations to the same major version.`}
			>
				Incompatible
			</StatusBadge>
		)
	}

	return peer.online ? (
		<StatusBadge tone="good">Online</StatusBadge>
	) : (
		<StatusBadge tone="disabled">Offline</StatusBadge>
	)
})
