import React, { useCallback, useState } from 'react'
import {
	CButton,
	CCard,
	CCardBody,
	CCardHeader,
	CCol,
	CFormInput,
	CFormLabel,
	CFormSwitch,
	CRow,
	CTable,
	CTableBody,
	CTableDataCell,
	CTableHead,
	CTableHeaderCell,
	CTableRow,
} from '@coreui/react'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import type {
	LinkControllerState,
	LinkPeerInfo,
	LinkTransportConfig,
	LinkTransportState,
} from '@companion-app/shared/Model/Link.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'

export function LinkPage(): React.JSX.Element {
	const linkState = useLinkState()

	return (
		<div>
			<h4>Companion Link</h4>
			<p>
				Companion Link is the next generation of Companion Cloud, taking a &ldquo;bring your own infrastructure&rdquo;
				approach. Instead of relying on a hosted cloud service, you connect your Companion instances together using
				off-the-shelf MQTT brokers that you deploy and manage yourself. This gives you full control over your data,
				latency, and network topology.
			</p>
			<p className="text-muted">
				Configure one or more MQTT transports below to enable peer discovery, remote button presses, and bitmap
				streaming between Companion instances.
			</p>

			{linkState ? <LinkPageContent state={linkState} /> : <LoadingRetryOrError dataReady={false} design="pulse" />}
		</div>
	)
}

// ── Hooks ──────────────────────────────────────────────────

function useLinkState(): LinkControllerState | null {
	const [state, setState] = useState<LinkControllerState | null>(null)

	useSubscription(
		trpc.link.watchState.subscriptionOptions(undefined, {
			onStarted: () => setState(null),
			onData: (data) => setState(data),
			onError: () => setState(null),
		})
	)

	return state
}

function useLinkTransportConfigs(): LinkTransportConfig[] | null {
	const [configs, setConfigs] = useState<LinkTransportConfig[] | null>(null)

	useSubscription(
		trpc.link.watchTransportConfigs.subscriptionOptions(undefined, {
			onStarted: () => setConfigs(null),
			onData: (data) => setConfigs(data),
			onError: () => setConfigs(null),
		})
	)

	return configs
}

function useLinkTransportStates(): LinkTransportState[] | null {
	const [states, setStates] = useState<LinkTransportState[] | null>(null)

	useSubscription(
		trpc.link.watchTransportStates.subscriptionOptions(undefined, {
			onStarted: () => setStates(null),
			onData: (data) => setStates(data),
			onError: () => setStates(null),
		})
	)

	return states
}

function useLinkPeers(): LinkPeerInfo[] | null {
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

// ── Main Content ───────────────────────────────────────────

function LinkPageContent({ state }: { state: LinkControllerState }): React.JSX.Element {
	const transportConfigs = useLinkTransportConfigs()
	const transportStates = useLinkTransportStates()
	const peers = useLinkPeers()

	const setEnabled = useMutationExt(trpc.link.setEnabled.mutationOptions())
	const regenerateUUID = useMutationExt(trpc.link.regenerateUUID.mutationOptions())

	const handleEnabledChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setEnabled.mutate({ enabled: e.target.checked })
		},
		[setEnabled]
	)

	const handleRegenerateUUID = useCallback(() => {
		if (window.confirm('Are you sure? This will change your instance identity for all peers.')) {
			regenerateUUID.mutate()
		}
	}, [regenerateUUID])

	return (
		<>
			{/* Settings Card */}
			<CCard className="mb-3">
				<CCardHeader>Settings</CCardHeader>
				<CCardBody>
					<CRow className="mb-3">
						<CCol sm={3}>
							<CFormLabel>Enabled</CFormLabel>
						</CCol>
						<CCol sm={9}>
							<CFormSwitch checked={state.enabled} onChange={handleEnabledChange} />
						</CCol>
					</CRow>
					<CRow className="mb-3">
						<CCol sm={3}>
							<CFormLabel>Instance Name</CFormLabel>
						</CCol>
						<CCol sm={9}>
							<span className="text-muted">
								This instance will be announced to peers using your <strong>Installation Name</strong> from the Settings
								page.
							</span>
						</CCol>
					</CRow>
					<CRow className="mb-3">
						<CCol sm={3}>
							<CFormLabel>Instance UUID</CFormLabel>
						</CCol>
						<CCol sm={9}>
							<div className="d-flex gap-2 align-items-center">
								<code>{state.uuid}</code>
								<CButton color="danger" size="sm" onClick={handleRegenerateUUID}>
									Regenerate
								</CButton>
							</div>
						</CCol>
					</CRow>
				</CCardBody>
			</CCard>

			{/* Transports Card */}
			<TransportsPanel configs={transportConfigs} states={transportStates} enabled={state.enabled} />

			{/* Peers Card */}
			<PeersPanel peers={peers} />
		</>
	)
}

// ── Transports Panel ───────────────────────────────────────

function TransportsPanel({
	configs,
	states,
	enabled,
}: {
	configs: LinkTransportConfig[] | null
	states: LinkTransportState[] | null
	enabled: boolean
}): React.JSX.Element {
	const addTransport = useMutationExt(trpc.link.addTransport.mutationOptions())
	const removeTransport = useMutationExt(trpc.link.removeTransport.mutationOptions())
	const updateTransport = useMutationExt(trpc.link.updateTransport.mutationOptions())

	const handleAddTransport = useCallback(() => {
		addTransport.mutate({ type: 'mqtt', label: 'New MQTT Transport' })
	}, [addTransport])

	const handleRemoveTransport = useCallback(
		(id: string) => {
			if (window.confirm('Remove this transport?')) {
				removeTransport.mutate({ id })
			}
		},
		[removeTransport]
	)

	return (
		<CCard className="mb-3">
			<CCardHeader className="d-flex justify-content-between align-items-center">
				<span>Transports</span>
				<CButton color="primary" size="sm" onClick={handleAddTransport} disabled={!enabled}>
					<FontAwesomeIcon icon={faPlus} /> Add MQTT Transport
				</CButton>
			</CCardHeader>
			<CCardBody>
				{!configs ? (
					<LoadingRetryOrError dataReady={false} design="pulse" />
				) : configs.length === 0 ? (
					<p className="text-muted">No transports configured. Add one to start connecting.</p>
				) : (
					configs.map((config) => {
						const transportState = states?.find((s) => s.id === config.id)
						return (
							<TransportConfigRow
								key={config.id}
								config={config}
								state={transportState ?? null}
								onRemove={handleRemoveTransport}
								onUpdate={(updates) => updateTransport.mutate({ id: config.id, ...updates })}
							/>
						)
					})
				)}
			</CCardBody>
		</CCard>
	)
}

interface TransportUpdateInput {
	label?: string
	enabled?: boolean
	config?: {
		brokerUrl?: string
		username?: string
		password?: string
		tls?: boolean
	}
}

function TransportConfigRow({
	config,
	state,
	onRemove,
	onUpdate,
}: {
	config: LinkTransportConfig
	state: LinkTransportState | null
	onRemove: (id: string) => void
	onUpdate: (updates: TransportUpdateInput) => void
}): React.JSX.Element {
	const statusColor = getStatusColor(state?.status ?? 'disconnected')

	return (
		<CCard className="mb-2">
			<CCardBody>
				<CRow className="align-items-center mb-2">
					<CCol sm={4}>
						<strong>{config.label}</strong>
						<span className={`ms-2 badge bg-${statusColor}`}>{state?.status ?? 'unknown'}</span>
						{state?.error && <small className="text-danger ms-2">{state.error}</small>}
					</CCol>
					<CCol sm={4} className="text-end">
						<CFormSwitch
							label="Enabled"
							checked={config.enabled}
							onChange={(e) => onUpdate({ enabled: e.target.checked })}
						/>
					</CCol>
					<CCol sm={4} className="text-end">
						<CButton color="danger" size="sm" onClick={() => onRemove(config.id)}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
					</CCol>
				</CRow>
				{config.type === 'mqtt' && (
					<MqttConfigFields config={config.config} onUpdate={(mqttUpdates) => onUpdate({ config: mqttUpdates })} />
				)}
			</CCardBody>
		</CCard>
	)
}

function MqttConfigFields({
	config,
	onUpdate,
}: {
	config: LinkTransportConfig['config']
	onUpdate: (updates: TransportUpdateInput['config']) => void
}): React.JSX.Element {
	return (
		<CRow>
			<CCol sm={6} className="mb-2">
				<CFormLabel>Broker URL</CFormLabel>
				<CFormInput
					value={config.brokerUrl}
					placeholder="mqtt://broker.example.com:1883"
					onChange={(e) => onUpdate({ brokerUrl: e.target.value })}
					onBlur={(e) => onUpdate({ brokerUrl: e.target.value })}
				/>
			</CCol>
			<CCol sm={3} className="mb-2">
				<CFormLabel>Username</CFormLabel>
				<CFormInput value={config.username} onChange={(e) => onUpdate({ username: e.target.value })} />
			</CCol>
			<CCol sm={3} className="mb-2">
				<CFormLabel>Password</CFormLabel>
				<CFormInput type="password" value={config.password} onChange={(e) => onUpdate({ password: e.target.value })} />
			</CCol>
		</CRow>
	)
}

// ── Peers Panel ────────────────────────────────────────────

function PeersPanel({ peers }: { peers: LinkPeerInfo[] | null }): React.JSX.Element {
	const deletePeer = useMutationExt(trpc.link.deletePeer.mutationOptions())

	const handleDeletePeer = useCallback(
		(peerId: string) => {
			if (window.confirm('Remove this peer from the list?')) {
				deletePeer.mutate({ peerId })
			}
		},
		[deletePeer]
	)

	return (
		<CCard className="mb-3">
			<CCardHeader>Discovered Peers</CCardHeader>
			<CCardBody>
				{!peers ? (
					<LoadingRetryOrError dataReady={false} design="pulse" />
				) : peers.length === 0 ? (
					<p className="text-muted">No peers discovered yet. Peers will appear here when they announce themselves.</p>
				) : (
					<CTable hover>
						<CTableHead>
							<CTableRow>
								<CTableHeaderCell>Name</CTableHeaderCell>
								<CTableHeaderCell>Status</CTableHeaderCell>
								<CTableHeaderCell>Version</CTableHeaderCell>
								<CTableHeaderCell>Pages</CTableHeaderCell>
								<CTableHeaderCell>Grid</CTableHeaderCell>
								<CTableHeaderCell>Last Seen</CTableHeaderCell>
								<CTableHeaderCell></CTableHeaderCell>
							</CTableRow>
						</CTableHead>
						<CTableBody>
							{peers.map((peer) => (
								<PeerRow key={peer.id} peer={peer} onDelete={handleDeletePeer} />
							))}
						</CTableBody>
					</CTable>
				)}
			</CCardBody>
		</CCard>
	)
}

function PeerRow({ peer, onDelete }: { peer: LinkPeerInfo; onDelete: (id: string) => void }): React.JSX.Element {
	const statusColor = peer.online ? 'success' : 'secondary'
	const lastSeenStr = peer.lastSeen ? new Date(peer.lastSeen).toLocaleString() : 'Never'

	return (
		<CTableRow>
			<CTableDataCell>
				<strong>{peer.name}</strong>
				<br />
				<small className="text-muted">{peer.id}</small>
			</CTableDataCell>
			<CTableDataCell>
				<span className={`badge bg-${statusColor}`}>{peer.online ? 'Online' : 'Offline'}</span>
				<br />
				<small className="text-muted">
					{peer.transports.length} transport{peer.transports.length !== 1 ? 's' : ''}
				</small>
			</CTableDataCell>
			<CTableDataCell>{peer.version}</CTableDataCell>
			<CTableDataCell>{peer.pageCount}</CTableDataCell>
			<CTableDataCell>
				{peer.gridSize.rows}×{peer.gridSize.cols}
			</CTableDataCell>
			<CTableDataCell>{lastSeenStr}</CTableDataCell>
			<CTableDataCell>
				<CButton color="danger" size="sm" onClick={() => onDelete(peer.id)}>
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
			</CTableDataCell>
		</CTableRow>
	)
}

// ── Helpers ────────────────────────────────────────────────

function getStatusColor(status: string): string {
	switch (status) {
		case 'connected':
			return 'success'
		case 'connecting':
			return 'warning'
		case 'error':
			return 'danger'
		default:
			return 'secondary'
	}
}
