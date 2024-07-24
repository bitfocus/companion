import React, { RefObject, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CButton, CButtonGroup, CFormSwitch, CPopover } from '@coreui/react'
import { ConnectionsContext, socketEmitPromise, SocketContext } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faSort,
	faExclamationTriangle,
	faCheckCircle,
	faEyeSlash,
	faQuestionCircle,
	faBug,
	faDollarSign,
	faTerminal,
	faTrash,
	faEllipsisV,
	faPlug,
} from '@fortawesome/free-solid-svg-icons'

import { ConnectionVariablesModal, ConnectionVariablesModalRef } from './ConnectionVariablesModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { useDrag, useDrop } from 'react-dnd'
import { windowLinkOpen } from '../Helpers/Window.js'
import classNames from 'classnames'
import type { ClientConnectionConfig, ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../Components/NonIdealState.js'
import { Tuck } from '../Components/Tuck.js'

interface VisibleConnectionsState {
	disabled: boolean
	ok: boolean
	warning: boolean
	error: boolean
}

interface ConnectionsListProps {
	showHelp: (connectionId: string) => void
	doConfigureConnection: (connectionId: string | null) => void
	connectionStatus: Record<string, ConnectionStatusEntry | undefined> | undefined
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
		(itemId: string, targetId: string) => {
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
						<th colSpan={3} className="fit">
							<CButtonGroup style={{ float: 'right', margin: 0 }}>
								<CButton
									size="sm"
									color="secondary"
									style={{
										backgroundColor: 'white',
										opacity: visibleConnections.disabled ? 1 : 0.4,
										padding: '1px 5px',
										color: 'black',
									}}
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
								<NonIdealState icon={faPlug}>
									You haven't set up any connections yet. <br />
									Try adding something from the list <span className="d-xl-none">below</span>
									<span className="d-none d-xl-inline">to the right</span>.
								</NonIdealState>
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

const ConnectionsTableRow = observer(function ConnectionsTableRow({
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
	const { socket, modules, variablesStore } = useContext(RootAppStoreContext)

	const moduleInfo = modules.modules.get(connection.instance_type)

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

	const connectionVariables = variablesStore.variables.get(connection.label)

	const doEdit = () => {
		if (!moduleInfo || !isEnabled) {
			return
		}

		configureConnection(id)
	}

	const openBugUrl = useCallback(() => {
		const url = moduleInfo?.bugUrl
		if (url) windowLinkOpen({ href: url })
	}, [moduleInfo])

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
						{moduleInfo.shortname ?? ''}

						<br />
						{moduleInfo.manufacturer ?? ''}
					</>
				) : (
					connection.instance_type
				)}
			</td>
			<ModuleStatusCall isEnabled={isEnabled} status={connectionStatus} onClick={doEdit} />
			<td className="action-buttons">
				<div style={{ display: 'flex' }}>
					<div>
						<CFormSwitch
							className="connection-enabled-switch"
							disabled={!moduleInfo}
							color="success"
							checked={isEnabled}
							onChange={doToggleEnabled}
							size="xl"
							title={isEnabled ? 'Disable connection' : 'Enable connection'}
						/>
					</div>
					<CPopover
						trigger="focus"
						placement="right"
						style={{ backgroundColor: 'white' }}
						content={
							<>
								<CButtonGroup vertical>
									<CButton
										onClick={doShowHelp}
										color="secondary"
										title="Help"
										disabled={!moduleInfo?.hasHelp}
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faQuestionCircle} />
										</Tuck>
										Help
									</CButton>

									<CButton
										onClick={openBugUrl}
										color="secondary"
										title="Issue Tracker"
										disabled={!moduleInfo?.bugUrl}
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faBug} />
										</Tuck>
										Known issues
									</CButton>

									<CButton
										onClick={doShowVariables}
										title="Variables"
										color="secondary"
										disabled={!isEnabled || !(connectionVariables && connectionVariables.size > 0)}
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faDollarSign} />
										</Tuck>
										Variables
									</CButton>

									<CButton
										onClick={() => windowLinkOpen({ href: `/connection-debug/${id}`, title: 'View debug log' })}
										title="Logs"
										color="secondary"
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faTerminal} />
										</Tuck>
										View logs
									</CButton>

									<CButton onClick={doDelete} title="Delete" color="secondary" style={{ textAlign: 'left' }}>
										<Tuck>
											<FontAwesomeIcon icon={faTrash} />
										</Tuck>
										Delete
									</CButton>
								</CButtonGroup>
							</>
						}
					>
						<CButton color="secondary" style={{ padding: '3px 16px' }}>
							<FontAwesomeIcon icon={faEllipsisV} />
						</CButton>
					</CPopover>
				</div>
			</td>
		</tr>
	)
})

interface ModuleStatusCallProps {
	isEnabled: boolean
	status: ConnectionStatusEntry | undefined
  onClick?: () => void
}

function ModuleStatusCall({ isEnabled, status, onClick }: ModuleStatusCallProps) {
	if (isEnabled) {
		const messageStr =
			!!status &&
			(typeof status.message === 'string' || typeof status.message === 'number' || !status.message
				? status.message || ''
				: JSON.stringify(status.message))

		switch (status?.category) {
			case 'good':
				return (
					<td className="hand" onClick={onClick}>
						<FontAwesomeIcon icon={faCheckCircle} color={'#33aa33'} size="2xl" />
					</td>
				)
			case 'warning':
				return (
					<td className="connection-status-warn" onClick={onClick}>
						{status.level || 'Warning'}
						<br />
						{messageStr}
					</td>
				)
			case 'error':
				return (
					<td className="connection-status-error" onClick={onClick}>
						{status.level || 'ERROR'}
						<br />
						{messageStr}
					</td>
				)
			default:
				return (
					<td className="connection-status-error" onClick={onClick}>
						Unknown
						<br />
						{messageStr}
					</td>
				)
		}
	} else {
		return (
			<td onClick={onClick}>
				<p>Disabled</p>
			</td>
		)
	}
}
