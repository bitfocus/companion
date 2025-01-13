import React, { RefObject, useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CFormSwitch, CPopover, CSpinner } from '@coreui/react'
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
	faTriangleExclamation,
	faPowerOff,
} from '@fortawesome/free-solid-svg-icons'
import { ConnectionVariablesModal, ConnectionVariablesModalRef } from './ConnectionVariablesModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { useDrag, useDrop } from 'react-dnd'
import { windowLinkOpen } from '../Helpers/Window.js'
import classNames from 'classnames'
import type { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../Components/NonIdealState.js'
import { Tuck } from '../Components/Tuck.js'
import { useTableVisibilityHelper, VisibilityButton } from '../Components/TableVisibility.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { InlineHelp } from '../Components/InlineHelp.js'

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

export const ConnectionsList = observer(function ConnectionsList({
	showHelp,
	doConfigureConnection,
	connectionStatus,
	selectedConnectionId,
}: ConnectionsListProps) {
	const { connections, socket } = useContext(RootAppStoreContext)

	const deleteModalRef = useRef<GenericConfirmModalRef>(null)
	const variablesModalRef = useRef<ConnectionVariablesModalRef>(null)

	const doShowVariables = useCallback((connectionId: string) => {
		variablesModalRef.current?.show(connectionId)
	}, [])

	const visibleConnections = useTableVisibilityHelper<VisibleConnectionsState>('connections_visible', {
		disabled: true,
		ok: true,
		warning: true,
		error: true,
	})

	const moveRow = useCallback(
		(itemId: string, targetId: string) => {
			const rawIds = Array.from(connections.connections.entries())
				.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
				.map(([id]) => id)

			const itemIndex = rawIds.indexOf(itemId)
			const targetIndex = rawIds.indexOf(targetId)
			if (itemIndex === -1 || targetIndex === -1) return

			const newIds = rawIds.filter((id) => id !== itemId)
			newIds.splice(targetIndex, 0, itemId)

			socket.emitPromise('connections:set-order', [newIds]).catch((e) => {
				console.error('Reorder failed', e)
			})
		},
		[socket, connections]
	)

	let visibleCount = 0

	const rows = Array.from(connections.connections.entries())
		.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
		.map(([id, connection]) => {
			const status = connectionStatus?.[id]

			if (!visibleConnections.visibility.disabled && connection.enabled === false) {
				return undefined
			} else if (status) {
				if (!visibleConnections.visibility.ok && status.category === 'good') {
					return undefined
				} else if (!visibleConnections.visibility.warning && status.category === 'warning') {
					return undefined
				} else if (!visibleConnections.visibility.error && status.category === 'error') {
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
	const hiddenCount = connections.count - visibleCount

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
							<CButtonGroup className="table-header-buttons">
								<VisibilityButton {...visibleConnections} keyId="disabled" color="secondary" label="Disabled" />
								<VisibilityButton {...visibleConnections} keyId="ok" color="success" label="OK" />
								<VisibilityButton {...visibleConnections} keyId="warning" color="warning" label="Warning" />
								<VisibilityButton {...visibleConnections} keyId="error" color="danger" label="Error" />
							</CButtonGroup>
						</th>
					</tr>
				</thead>
				<tbody>
					{rows}
					{hiddenCount > 0 && (
						<tr>
							<td colSpan={4} style={{ padding: '10px 5px' }}>
								<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
								<strong>{hiddenCount} Connections are hidden</strong>
							</td>
						</tr>
					)}
					{connections.count === 0 && (
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
})

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
			[
				`Are you sure you want to delete "${connection.label}"?`,
				'This will remove all actions and feedbacks associated with this connection.',
			],
			'Delete',
			() => {
				socket.emitPromise('connections:delete', [id]).catch((e) => {
					console.error('Delete failed', e)
				})
				configureConnection(null)
			}
		)
	}, [socket, deleteModalRef, id, connection.label, configureConnection])

	const doToggleEnabled = useCallback(() => {
		socket.emitPromise('connections:set-enabled', [id, !isEnabled]).catch((e) => {
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
		if (!moduleInfo) {
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
			<td className="hand" onClick={doEdit}>
				<ModuleStatusCall isEnabled={isEnabled} status={connectionStatus} />
			</td>
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
								{/* Note: the popover closing due to focus loss stops mouseup/click events propagating */}
								<CButtonGroup vertical>
									<CButton
										onMouseDown={doShowHelp}
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
										onMouseDown={openBugUrl}
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
										onMouseDown={doShowVariables}
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
										onMouseDown={() => windowLinkOpen({ href: `/connection-debug/${id}`, title: 'View debug log' })}
										title="Logs"
										color="secondary"
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faTerminal} />
										</Tuck>
										View logs
									</CButton>

									<CButton onMouseDown={doDelete} title="Delete" color="secondary" style={{ textAlign: 'left' }}>
										<Tuck>
											<FontAwesomeIcon icon={faTrash} />
										</Tuck>
										Delete
									</CButton>
								</CButtonGroup>
							</>
						}
					>
						<CButton color="secondary" style={{ padding: '3px 16px' }} onClick={(e) => e.currentTarget.focus()}>
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
				return <FontAwesomeIcon icon={faCheckCircle} color={'#33aa33'} size="2xl" />
			case 'warning':
				return (
					<InlineHelp help={`${status.level ?? 'Warning'}${messageStr ? ': ' + messageStr : ''}`}>
						<FontAwesomeIcon icon={faTriangleExclamation} color={'#fab92c'} size="2xl" />
					</InlineHelp>
				)
			case 'error':
				return status?.level === 'Connecting' ? (
					<InlineHelp help={`${status.level ?? 'Error'}${messageStr ? ': ' + messageStr : ''}`}>
						<CSpinner color="warning"></CSpinner>
					</InlineHelp>
				) : (
					<InlineHelp help={`${status.level ?? 'Error'}${messageStr ? ': ' + messageStr : ''}`}>
						<FontAwesomeIcon icon={faTriangleExclamation} color={'#d50215'} size="2xl" />
					</InlineHelp>
				)

			default:
				return (
					<InlineHelp help={`Unknown${messageStr ? ': ' + messageStr : ''}`}>
						<FontAwesomeIcon icon={faTriangleExclamation} color={'#fab92c'} size="2xl" />
					</InlineHelp>
				)
		}
	} else {
		return <FontAwesomeIcon icon={faPowerOff} color={'gray'} size="2xl" />
	}
}
