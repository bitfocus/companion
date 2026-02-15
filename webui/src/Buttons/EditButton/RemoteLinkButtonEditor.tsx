import React, { useCallback, useState } from 'react'
import { CCol, CFormLabel, CFormSelect } from '@coreui/react'
import { TextInputField } from '~/Components/TextInputField.js'
import type { RemoteLinkButtonModel, RemoteLinkButtonRuntimeProps } from '@companion-app/shared/Model/ButtonModel.js'
import type { LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useSubscription } from '@trpc/tanstack-react-query'

interface RemoteLinkButtonEditorProps {
	controlId: string
	config: RemoteLinkButtonModel
	runtimeProps: Record<string, any> | false
}

function useLinkPeersForEditor(): LinkPeerInfo[] | null {
	const [peers, setPeers] = useState<LinkPeerInfo[] | null>(null)

	useSubscription(
		trpc.link.watchPeers.subscriptionOptions(undefined, {
			onStarted: () => setPeers(null),
			onData: (data) => setPeers(data),
			onError: () => setPeers(null),
		})
	)

	return peers
}

export function RemoteLinkButtonEditor({
	controlId,
	config,
	runtimeProps,
}: RemoteLinkButtonEditorProps): React.JSX.Element {
	const peers = useLinkPeersForEditor()

	const setLinkConfig = useMutationExt(trpc.controls.setLinkConfig.mutationOptions())

	const setPeerUuid = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			setLinkConfig.mutate({ controlId, config: { peerUuid: e.target.value } })
		},
		[controlId, setLinkConfig]
	)

	const setLocation = useCallback(
		(value: string) => {
			setLinkConfig.mutate({ controlId, config: { location: value } })
		},
		[controlId, setLinkConfig]
	)

	const runtime = runtimeProps as RemoteLinkButtonRuntimeProps | false

	return (
		<>
			<h4>Remote Link button</h4>
			<p className="mt-2">
				This button mirrors a button from a remote Companion instance. Configure the target peer and button location
				below.
			</p>

			{runtime && (
				<div className="mb-3">
					<StatusDisplay visualState={runtime.visualState} peerName={runtime.peerName} />
				</div>
			)}

			<CCol sm={12} className="mb-3">
				<CFormLabel>Target Peer</CFormLabel>
				<CFormSelect value={config.peerUuid} onChange={setPeerUuid}>
					<option value="">-- Select a peer --</option>
					{peers?.map((peer) => (
						<option key={peer.id} value={peer.id}>
							{peer.name} {!peer.online ? '(offline)' : ''}
						</option>
					))}
				</CFormSelect>
			</CCol>

			<CCol sm={12} className="mb-3">
				<CFormLabel>Location</CFormLabel>
				<TextInputField
					tooltip="Button location in Companion format. Examples: 1/0/0, $(this:page)/$(this:row)/$(this:column), this"
					value={config.location}
					setValue={setLocation}
					useVariables
					placeholder="e.g. 1/0/0 or $(this:page)/$(this:row)/$(this:column)"
				/>
			</CCol>
		</>
	)
}

function StatusDisplay({ visualState, peerName }: { visualState: string; peerName: string | null }): React.JSX.Element {
	let statusText: string
	let statusColor: string

	switch (visualState) {
		case 'bitmap':
			statusText = 'Connected'
			statusColor = 'success'
			break
		case 'loading':
			statusText = 'Loading...'
			statusColor = 'warning'
			break
		case 'unreachable':
			statusText = 'Peer offline'
			statusColor = 'danger'
			break
		case 'loop_detected':
			statusText = 'Loop detected'
			statusColor = 'danger'
			break
		case 'unknown_peer':
		default:
			statusText = 'Unknown peer'
			statusColor = 'secondary'
			break
	}

	return (
		<div className={`alert alert-${statusColor} py-1 px-2 mb-0`}>
			<strong>Status:</strong> {statusText}
			{peerName && (
				<span>
					{' '}
					— Peer: <em>{peerName}</em>
				</span>
			)}
		</div>
	)
}
