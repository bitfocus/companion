import React, { RefObject, useCallback, useContext, useRef } from 'react'
import { CAlert, CButton, CButtonGroup, CFormSwitch, CPopover } from '@coreui/react'
import { socketEmitPromise, useComputed } from '../util.js'
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
	faDownload,
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
import { NewClientModuleVersionInfo2 } from '@companion-app/shared/Model/ModuleInfo.js'
import { getModuleVersionInfoForConnection } from './Util.js'

interface VisibleConnectionsState {
	disabled: boolean
	ok: boolean
	warning: boolean
	error: boolean
}

interface ConnectionsListProps {
	showHelp: (connectionId: string, moduleVersion: NewClientModuleVersionInfo2) => void
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

			socketEmitPromise(socket, 'connections:set-order', [newIds]).catch((e) => {
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

			if (!visibleConnections.visiblity.disabled && connection.enabled === false) {
				return undefined
			} else if (status) {
				if (!visibleConnections.visiblity.ok && status.category === 'good') {
					return undefined
				} else if (!visibleConnections.visiblity.warning && status.category === 'warning') {
					return undefined
				} else if (!visibleConnections.visiblity.error && status.category === 'error') {
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

			<MissingVersionsWarning />

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
								<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'red' }} />
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
	showHelp: (connectionId: string, moduleVersion: NewClientModuleVersionInfo2) => void
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

	const doShowHelp = useCallback(
		() => moduleVersion?.hasHelp && showHelp(connection.instance_type, moduleVersion),
		[showHelp, connection.instance_type]
	)

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

	const doEdit = useCallback(() => configureConnection(id), [id])

	const openBugUrl = useCallback(() => {
		const url = moduleInfo?.baseInfo?.bugUrl
		if (url) windowLinkOpen({ href: url })
	}, [moduleInfo])

	const moduleVersion = getModuleVersionInfoForConnection(moduleInfo, connection.moduleVersionId)

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
						{moduleInfo.baseInfo.shortname ?? ''}
						<br />
						{moduleInfo.baseInfo.manufacturer ?? ''}
						<br />
						{moduleVersion?.isLegacy && (
							<>
								<FontAwesomeIcon
									icon={faExclamationTriangle}
									color="#f80"
									title="This module has not been updated for Companion 3.0, and may not work fully"
								/>{' '}
							</>
						)}
						{moduleVersion?.displayName ?? connection.moduleVersionId}
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
							disabled={!moduleInfo || !moduleVersion}
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
										disabled={!moduleVersion?.hasHelp}
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
										disabled={!moduleInfo?.baseInfo?.bugUrl}
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
					<td className="connection-status-warn hand" onClick={onClick}>
						{status.level || 'Warning'}
						<br />
						{messageStr}
					</td>
				)
			case 'error':
				return (
					<td className="connection-status-error hand" onClick={onClick}>
						{status.level !== 'system' && (
							<>
								{status.level || 'ERROR'}
								<br />
							</>
						)}
						{messageStr}
					</td>
				)
			default:
				return (
					<td className="connection-status-error hand" onClick={onClick}>
						Unknown
						<br />
						{messageStr}
					</td>
				)
		}
	} else {
		return (
			<td onClick={onClick} className="hand">
				Disabled
			</td>
		)
	}
}

const MissingVersionsWarning = observer(function MissingVersionsWarning() {
	const { socket, connections, modules } = useContext(RootAppStoreContext)

	const missingCount = useComputed(() => {
		let count = 0

		for (const connection of connections.connections.values()) {
			if (connection.moduleVersionId === null) {
				count++
				continue
			}

			const module = modules.modules.get(connection.instance_type)
			if (!module) {
				count++
				continue
			}

			// check for version
			if (module.devVersion && connection.moduleVersionId === 'dev') continue
			if (module.installedVersions.find((v) => v.versionId === connection.moduleVersionId)) continue

			// Not found
			count++
		}

		return count
	}, [connections, modules])

	const doInstallAllMissing = useCallback(() => {
		socketEmitPromise(socket, 'modules:install-all-missing', []).catch((e) => {
			console.error('Install all missing failed', e)
		})
	}, [socket])

	if (missingCount === 0) return null

	return (
		<CAlert color="info">
			Some modules are missing version information.
			<br />
			<CButton color="info" onClick={doInstallAllMissing}>
				<FontAwesomeIcon icon={faDownload} />
				&nbsp;Install missing versions
			</CButton>
		</CAlert>
	)
})
