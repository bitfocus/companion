import React, { RefObject, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import {
	ConnectionsContext,
	VariableDefinitionsContext,
	socketEmitPromise,
	SocketContext,
	ModulesContext,
} from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faDollarSign,
	faSort,
	faExclamationTriangle,
	faTrash,
	faTerminal,
	faCheckCircle,
	faQuestionCircle,
	faBug,
	faEyeSlash,
} from '@fortawesome/free-solid-svg-icons'

import { ConnectionVariablesModal, ConnectionVariablesModalRef } from './ConnectionVariablesModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import CSwitch from '../CSwitch.js'
import { useDrag, useDrop } from 'react-dnd'
import { windowLinkOpen } from '../Helpers/Window.js'
import classNames from 'classnames'
import type { ClientConnectionConfig, ConnectionStatusEntry } from '@companion/shared/Model/Common.js'

interface VisibleConnectionsState {
	disabled: boolean
	ok: boolean
	warning: boolean
	error: boolean
}

interface ConnectionsListProps {
	showHelp: (connectionId: string) => void
	doConfigureConnection: (connectionId: string | null) => void
	connectionStatus: Record<string, ConnectionStatusEntry | undefined>
	selectedConnectionId: string | null
}

export function ConnectionsList({
	showHelp,
	doConfigureConnection,
	connectionStatus,
	selectedConnectionId,
}: ConnectionsListProps) {
	const socket = useContext(SocketContext)
	const connectionsContext = useContext(ConnectionsContext)

	const connectionsRef = useRef<Record<string, ClientConnectionConfig>>()
	useEffect(() => {
		connectionsRef.current = connectionsContext
	}, [connectionsContext])

	const deleteModalRef = useRef<GenericConfirmModalRef>(null)
	const variablesModalRef = useRef<ConnectionVariablesModalRef>(null)

	const doShowVariables = useCallback((connectionId: string) => {
		variablesModalRef.current?.show(connectionId)
	}, [])

	const [visibleConnections, setVisibleConnections] = useState<VisibleConnectionsState>(() => loadVisibility())

	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem('connections_visible', JSON.stringify(visibleConnections))
	}, [visibleConnections])

	const doToggleVisibility = useCallback((key: keyof VisibleConnectionsState) => {
		setVisibleConnections((oldConfig) => ({
			...oldConfig,
			[key]: !oldConfig[key],
		}))
	}, [])

	const doToggleDisabled = useCallback(() => doToggleVisibility('disabled'), [doToggleVisibility])
	const doToggleOk = useCallback(() => doToggleVisibility('ok'), [doToggleVisibility])
	const doToggleWarning = useCallback(() => doToggleVisibility('warning'), [doToggleVisibility])
	const doToggleError = useCallback(() => doToggleVisibility('error'), [doToggleVisibility])

	const moveRow = useCallback(
		(itemId, targetId) => {
			if (connectionsRef.current) {
				const rawIds = Object.entries(connectionsRef.current)
					.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
					.map(([id]) => id)

				const itemIndex = rawIds.indexOf(itemId)
				const targetIndex = rawIds.indexOf(targetId)
				if (itemIndex === -1 || targetIndex === -1) return

				const newIds = rawIds.filter((id) => id !== itemId)
				newIds.splice(targetIndex, 0, itemId)

				socketEmitPromise(socket, 'connections:set-order', [newIds]).catch((e) => {
					console.error('Reorder failed', e)
				})
			}
		},
		[socket]
	)

	let visibleCount = 0

	const rows = Object.entries(connectionsContext)
		.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
		.map(([id, connection]) => {
			const status = connectionStatus?.[id]

			if (!visibleConnections.disabled && connection.enabled === false) {
				return undefined
			} else if (status) {
				if (!visibleConnections.ok && status.category === 'good') {
					return undefined
				} else if (!visibleConnections.warning && status.category === 'warning') {
					return undefined
				} else if (!visibleConnections.error && status.category === 'error') {
					return undefined
				}
			}

			visibleCount++

			return (
				<ConnectionsTableRow
					key={id}
					id={id}
					connection={connection}
					connectionStatus={status}
					showHelp={showHelp}
					showVariables={doShowVariables}
					deleteModalRef={deleteModalRef}
					configureConnection={doConfigureConnection}
					moveRow={moveRow}
					isSelected={id === selectedConnectionId}
				/>
			)
		})
	const hiddenCount = Object.keys(connectionsContext).length - visibleCount

	return (
		<div>
			<h4>Connections</h4>

			<p>
				When you want to control devices or software with Companion, you need to add a connection to let Companion know
				how to communicate with whatever you want to control.
			</p>

			<GenericConfirmModal ref={deleteModalRef} />
			<ConnectionVariablesModal ref={variablesModalRef} />

			<table className="table-tight table-responsive-sm">
				<thead>
					<tr>
						<th className="fit">&nbsp;</th>
						<th>Label</th>
						<th>Module</th>
						<th colSpan={2} className="fit">
							Status
							<CButtonGroup style={{ float: 'right', margin: 0 }}>
								<CButton
									color="secondary"
									size="sm"
									style={{ opacity: visibleConnections.disabled ? 1 : 0.4, padding: '1px 5px', color: 'black' }}
									onClick={doToggleDisabled}
								>
									Disabled
								</CButton>
								<CButton
									size="sm"
									color="success"
									style={{ opacity: visibleConnections.ok ? 1 : 0.4, padding: '1px 5px' }}
									onClick={doToggleOk}
								>
									OK
								</CButton>
								<CButton
									color="warning"
									size="sm"
									style={{ opacity: visibleConnections.warning ? 1 : 0.4, padding: '1px 5px' }}
									onClick={doToggleWarning}
								>
									Warning
								</CButton>
								<CButton
									color="danger"
									size="sm"
									style={{ opacity: visibleConnections.error ? 1 : 0.4, padding: '1px 5px' }}
									onClick={doToggleError}
								>
									Error
								</CButton>
							</CButtonGroup>
						</th>
					</tr>
				</thead>
				<tbody>
					{rows}
					{hiddenCount > 0 && (
						<tr>
							<td colSpan={4} style={{ padding: '10px 5px' }}>
								<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'red' }} />
								<strong>{hiddenCount} Connections are hidden</strong>
							</td>
						</tr>
					)}
					{Object.keys(connectionsContext).length === 0 && (
						<tr>
							<td colSpan={4}>
								You haven't setup any connections yet. <br />
								Try adding something from the list <span className="d-xl-none">below</span>
								<span className="d-none d-xl-inline">to the right</span>.
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	)
}

function loadVisibility(): VisibleConnectionsState {
	try {
		const rawConfig = window.localStorage.getItem('connections_visible')
		if (rawConfig !== null) {
			return JSON.parse(rawConfig) ?? {}
		}
	} catch (e) {}

	// setup defaults
	const config: VisibleConnectionsState = {
		disabled: true,
		ok: true,
		warning: true,
		error: true,
	}

	window.localStorage.setItem('connections_visible', JSON.stringify(config))

	return config
}

interface ConnectionDragItem {
	id: string
}
interface ConnectionDragStatus {
	isDragging: boolean
}

interface ConnectionsTableRowProps {
	id: string
	connection: ClientConnectionConfig
	connectionStatus: ConnectionStatusEntry | undefined
	showHelp: (connectionId: string) => void
	showVariables: (label: string) => void
	configureConnection: (connectionId: string | null) => void
	deleteModalRef: RefObject<GenericConfirmModalRef>
	moveRow: (itemId: string, targetId: string) => void
	isSelected: boolean
}

function ConnectionsTableRow({
	id,
	connection,
	connectionStatus,
	showHelp,
	showVariables,
	configureConnection,
	deleteModalRef,
	moveRow,
	isSelected,
}: ConnectionsTableRowProps) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const moduleInfo = modules[connection.instance_type]

	const isEnabled = connection.enabled === undefined || connection.enabled

	const doDelete = useCallback(() => {
		deleteModalRef.current?.show(
			'Delete connection',
			`Are you sure you want to delete "${connection.label}"?`,
			'Delete',
			() => {
				socketEmitPromise(socket, 'connections:delete', [id]).catch((e) => {
					console.error('Delete failed', e)
				})
				configureConnection(null)
			}
		)
	}, [socket, deleteModalRef, id, connection.label, configureConnection])

	const doToggleEnabled = useCallback(() => {
		socketEmitPromise(socket, 'connections:set-enabled', [id, !isEnabled]).catch((e) => {
			console.error('Set enabled failed', e)
		})
	}, [socket, id, isEnabled])

	const doShowHelp = useCallback(() => showHelp(connection.instance_type), [showHelp, connection.instance_type])

	const doShowVariables = useCallback(() => showVariables(connection.label), [showVariables, connection.label])

	const ref = useRef(null)
	const [, drop] = useDrop<ConnectionDragItem>({
		accept: 'connection',
		hover(item, _monitor) {
			if (!ref.current) {
				return
			}
			// Don't replace items with themselves
			if (item.id === id) {
				return
			}

			// Time to actually perform the action
			moveRow(item.id, id)
		},
	})
	const [{ isDragging }, drag, preview] = useDrag<ConnectionDragItem, unknown, ConnectionDragStatus>({
		type: 'connection',
		item: {
			id,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	const connectionVariables = variableDefinitionsContext[connection.label]

	const doEdit = () => {
		if (!moduleInfo || !isEnabled) {
			return
		}

		configureConnection(id)
	}

	return (
		<tr
			ref={ref}
			className={classNames({
				'connectionlist-dragging': isDragging,
				'connectionlist-notdragging': !isDragging,
				'connectionlist-selected': isSelected,
			})}
		>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td onClick={doEdit} className="hand">
				<b>{connection.label}</b>
			</td>
			<td onClick={doEdit} className="hand">
				{moduleInfo ? (
					<>
						{moduleInfo.isLegacy && (
							<>
								<FontAwesomeIcon
									icon={faExclamationTriangle}
									color="#f80"
									title="This module has not been updated for Companion 3.0, and may not work fully"
								/>{' '}
							</>
						)}
						{moduleInfo?.shortname ?? ''}

						<br />
						{moduleInfo?.manufacturer ?? ''}
					</>
				) : (
					connection.instance_type
				)}
			</td>
			<ModuleStatusCall isEnabled={isEnabled} status={connectionStatus} />
			<td className="action-buttons">
				<div style={{ display: 'flex' }}>
					<div>
						<CButtonGroup>
							<CButton
								onClick={doShowHelp}
								title="Help"
								size="md"
								disabled={!moduleInfo?.hasHelp}
								style={{ padding: 4 }}
							>
								<FontAwesomeIcon icon={faQuestionCircle} />
							</CButton>

							<CButton
								onClick={() => windowLinkOpen({ href: moduleInfo?.bugUrl })}
								size="md"
								title="Issue Tracker"
								disabled={!moduleInfo?.bugUrl}
								style={{ padding: 4 }}
							>
								<FontAwesomeIcon icon={faBug} />
							</CButton>

							<CButton
								onClick={doShowVariables}
								title="Variables"
								size="md"
								style={{
									padding: 4,
									opacity:
										!isEnabled || !(connectionVariables && Object.keys(connectionVariables).length > 0) ? 0.2 : 1,
								}}
								disabled={!isEnabled || !(connectionVariables && Object.keys(connectionVariables).length > 0)}
							>
								<FontAwesomeIcon icon={faDollarSign} />
							</CButton>

							<CButton
								onClick={() => windowLinkOpen({ href: `/connection-debug/${id}`, title: 'View debug log' })}
								size="md"
								title="Logs"
								disabled={!isEnabled}
								style={{ padding: 4 }}
							>
								<FontAwesomeIcon icon={faTerminal} />
							</CButton>

							<CButton onClick={doDelete} size="md" title="Delete" color="#ff00ff" style={{ padding: 4 }}>
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
						</CButtonGroup>
					</div>
					<div style={{ paddingTop: 1, paddingLeft: 4 }}>
						<CSwitch
							disabled={!moduleInfo}
							color="success"
							checked={isEnabled}
							onChange={doToggleEnabled}
							title={isEnabled ? 'Disable connection' : 'Enable connection'}
						/>
					</div>
				</div>
			</td>
		</tr>
	)
}

interface ModuleStatusCallProps {
	isEnabled: boolean
	status: ConnectionStatusEntry | undefined
}

function ModuleStatusCall({ isEnabled, status }: ModuleStatusCallProps) {
	if (isEnabled) {
		const messageStr =
			!!status &&
			(typeof status.message === 'string' || typeof status.message === 'number' || !status.message
				? status.message || ''
				: JSON.stringify(status.message))

		switch (status?.category) {
			case 'good':
				return (
					<td className="hand">
						<FontAwesomeIcon icon={faCheckCircle} color={'#33aa33'} size="2xl" />
					</td>
				)
			case 'warning':
				return (
					<td className="connection-status-warn">
						{status.level || 'Warning'}
						<br />
						{messageStr}
					</td>
				)
			case 'error':
				return (
					<td className="connection-status-error">
						{status.level || 'ERROR'}
						<br />
						{messageStr}
					</td>
				)
			default:
				return (
					<td className="connection-status-error">
						Unknown
						<br />
						{messageStr}
					</td>
				)
		}
	} else {
		return (
			<td>
				<p>Disabled</p>
			</td>
		)
	}
}
