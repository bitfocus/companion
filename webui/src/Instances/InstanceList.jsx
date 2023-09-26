import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { InstancesContext, VariableDefinitionsContext, socketEmitPromise, SocketContext, ModulesContext } from '../util'
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

import { InstanceVariablesModal } from './InstanceVariablesModal'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import CSwitch from '../CSwitch'
import { useDrag, useDrop } from 'react-dnd'
import { windowLinkOpen } from '../Helpers/Window'
import classNames from 'classnames'

export function InstancesList({ showHelp, doConfigureInstance, instanceStatus, selectedInstanceId }) {
	const socket = useContext(SocketContext)
	const instancesContext = useContext(InstancesContext)

	const instancesRef = useRef(null)
	useEffect(() => {
		instancesRef.current = instancesContext
	}, [instancesContext])

	const deleteModalRef = useRef()
	const variablesModalRef = useRef()

	const doShowVariables = useCallback((instanceId) => {
		variablesModalRef.current.show(instanceId)
	}, [])

	const [visibleConnections, setVisibleConnections] = useState(() => loadVisibility())

	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem('connections_visible', JSON.stringify(visibleConnections))
	}, [visibleConnections])

	const doToggleVisibility = useCallback((key) => {
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
			if (instancesRef.current) {
				const rawIds = Object.entries(instancesRef.current)
					.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
					.map(([id]) => id)

				const itemIndex = rawIds.indexOf(itemId)
				const targetIndex = rawIds.indexOf(targetId)
				if (itemIndex === -1 || targetIndex === -1) return

				const newIds = rawIds.filter((id) => id !== itemId)
				newIds.splice(targetIndex, 0, itemId)

				socketEmitPromise(socket, 'instances:set-order', [newIds]).catch((e) => {
					console.error('Reorder failed', e)
				})
			}
		},
		[socket]
	)

	let visibleCount = 0

	const rows = Object.entries(instancesContext)
		.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
		.map(([id, instance]) => {
			const status = instanceStatus?.[id]

			if (!visibleConnections.disabled && instance.enabled === false) {
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
				<InstancesTableRow
					key={id}
					id={id}
					instance={instance}
					instanceStatus={status}
					showHelp={showHelp}
					showVariables={doShowVariables}
					deleteModalRef={deleteModalRef}
					configureInstance={doConfigureInstance}
					moveRow={moveRow}
					isSelected={id === selectedInstanceId}
				/>
			)
		})
	const hiddenCount = Object.keys(instancesContext).length - visibleCount

	return (
		<div>
			<h4>Connections</h4>

			<p>
				When you want to control devices or software with Companion, you need to add a connection to let Companion know
				how to communicate with whatever you want to control.
			</p>

			<GenericConfirmModal ref={deleteModalRef} />
			<InstanceVariablesModal ref={variablesModalRef} />

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
					{Object.keys(instancesContext).length === 0 && (
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

function loadVisibility() {
	try {
		const rawConfig = window.localStorage.getItem('connections_visible')
		if (rawConfig !== null) {
			return JSON.parse(rawConfig) ?? {}
		}
	} catch (e) {}

	// setup defaults
	const config = {
		disabled: true,
		ok: true,
		warning: true,
		error: true,
	}

	window.localStorage.setItem('connections_visible', JSON.stringify(config))

	return config
}

function InstancesTableRow({
	id,
	instance,
	instanceStatus,
	showHelp,
	showVariables,
	configureInstance,
	deleteModalRef,
	moveRow,
	isSelected,
}) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const moduleInfo = modules[instance.instance_type]

	const isEnabled = instance.enabled === undefined || instance.enabled

	const doDelete = useCallback(() => {
		deleteModalRef.current.show(
			'Delete connection',
			`Are you sure you want to delete "${instance.label}"?`,
			'Delete',
			() => {
				socketEmitPromise(socket, 'instances:delete', [id]).catch((e) => {
					console.error('Delete failed', e)
				})
				configureInstance(null)
			}
		)
	}, [socket, deleteModalRef, id, instance.label, configureInstance])

	const doToggleEnabled = useCallback(() => {
		socketEmitPromise(socket, 'instances:set-enabled', [id, !isEnabled]).catch((e) => {
			console.error('Set enabled failed', e)
		})
	}, [socket, id, isEnabled])

	const doShowHelp = useCallback(() => showHelp(instance.instance_type), [showHelp, instance.instance_type])

	const doShowVariables = useCallback(() => showVariables(instance.label), [showVariables, instance.label])

	const ref = useRef(null)
	const [, drop] = useDrop({
		accept: 'connection',
		hover(item, monitor) {
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
	const [{ isDragging }, drag, preview] = useDrag({
		type: 'connection',
		item: {
			id,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	const instanceVariables = variableDefinitionsContext[instance.label]

	const doEdit = () => {
		if (!moduleInfo || !isEnabled) {
			return
		}

		configureInstance(id)
	}

	return (
		<tr
			ref={ref}
			className={classNames({
				'instancelist-dragging': isDragging,
				'instancelist-notdragging': !isDragging,
				'instancelist-selected': isSelected,
			})}
		>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td onClick={doEdit} className="hand">
				<b>{instance.label}</b>
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
					instance.instance_type
				)}
			</td>
			<ModuleStatusCall isEnabled={isEnabled} status={instanceStatus} />
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
								onClick={(e) => windowLinkOpen({ href: moduleInfo?.bugUrl })}
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
									opacity: !isEnabled || !(instanceVariables && Object.keys(instanceVariables).length > 0) ? 0.2 : 1,
								}}
								disabled={!isEnabled || !(instanceVariables && Object.keys(instanceVariables).length > 0)}
							>
								<FontAwesomeIcon icon={faDollarSign} />
							</CButton>

							<CButton
								onClick={(e) => windowLinkOpen({ href: `/connection-debug/${id}`, title: 'View debug log' })}
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

function ModuleStatusCall({ isEnabled, status }) {
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
					<td className="instance-status-warn">
						{status.level || 'Warning'}
						<br />
						{messageStr}
					</td>
				)
			case 'error':
				return (
					<td className="instance-status-error">
						{status.level || 'ERROR'}
						<br />
						{messageStr}
					</td>
				)
			default:
				return (
					<td className="instance-status-error">
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
