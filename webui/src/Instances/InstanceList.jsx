import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { InstancesContext, VariableDefinitionsContext, socketEmitPromise, SocketContext, ModulesContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faDollarSign,
	faQuestionCircle,
	faBug,
	faSort,
	faExclamationTriangle,
	faBarsStaggered,
} from '@fortawesome/free-solid-svg-icons'
import { InstanceVariablesModal } from './InstanceVariablesModal'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import CSwitch from '../CSwitch'
import { useDrag, useDrop } from 'react-dnd'

export function InstancesList({ showHelp, doConfigureInstance, instanceStatus }) {
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

			<CButtonGroup style={{ marginBottom: '0.3em' }}>
				<CButton
					size="sm"
					color="light"
					style={{ opacity: visibleConnections.disabled ? 1 : 0.2 }}
					onClick={doToggleDisabled}
				>
					Disabled
				</CButton>
				<CButton size="sm" color="success" style={{ opacity: visibleConnections.ok ? 1 : 0.2 }} onClick={doToggleOk}>
					OK
				</CButton>
				<CButton
					size="sm"
					color="warning"
					style={{ opacity: visibleConnections.warning ? 1 : 0.2 }}
					onClick={doToggleWarning}
				>
					Warning
				</CButton>
				<CButton
					size="sm"
					color="danger"
					style={{ opacity: visibleConnections.error ? 1 : 0.2 }}
					onClick={doToggleError}
				>
					Error
				</CButton>
			</CButtonGroup>

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th className="fit">&nbsp;</th>
						<th>Module</th>
						<th>Label</th>
						<th>Status</th>
						<th className="fit">&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{rows}
					{hiddenCount > 0 && (
						<tr>
							<td colSpan={4}>{hiddenCount} Connections are hidden</td>
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
}) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const moduleInfo = modules[instance.instance_type]

	const status = processModuleStatus(instanceStatus)
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

	return (
		<tr ref={ref} className={isDragging ? 'instancelist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				{moduleInfo ? (
					<>
						<div className="float_right">
							{moduleInfo.isLegacy && (
								<FontAwesomeIcon
									icon={faExclamationTriangle}
									title="This module has not been updated for Companion 3.0, and may be broken as a result"
								/>
							)}
							{moduleInfo.hasHelp && (
								<div onClick={doShowHelp} title="Help">
									<FontAwesomeIcon icon={faQuestionCircle} />
								</div>
							)}
							{moduleInfo.bugUrl && (
								<a href={moduleInfo.bugUrl} target="_blank" rel="noreferrer" title="Report Bug">
									<FontAwesomeIcon icon={faBug} />
								</a>
							)}
							<a href={`/connection-debug/${id}`} target="_blank" rel="noreferrer" title="View debug log">
								<FontAwesomeIcon icon={faBarsStaggered} />
							</a>
						</div>

						<b>{moduleInfo?.shortname ?? ''}</b>
						<br />
						{moduleInfo?.manufacturer ?? ''}
					</>
				) : (
					instance.instance_type
				)}
			</td>
			<td>
				{instanceVariables && Object.keys(instanceVariables).length > 0 && (
					<div className="float_right" onClick={doShowVariables} title="Variables">
						<FontAwesomeIcon icon={faDollarSign} />
					</div>
				)}
				{instance.label}
			</td>
			<td className={status.className}>
				{isEnabled ? (
					<>
						<p>{status.text}</p>
						<p>{typeof status.message === 'string' ? status.message : JSON.stringify(status.message)}</p>
					</>
				) : (
					<p>Disabled</p>
				)}
			</td>
			<td className="action-buttons">
				<CSwitch
					disabled={!moduleInfo}
					color="info"
					checked={isEnabled}
					onChange={doToggleEnabled}
					title={isEnabled ? 'Disable connection' : 'Enable connection'}
				/>
				&nbsp;
				<CButtonGroup>
					<CButton onClick={() => configureInstance(id)} color="info" size="sm" disabled={!moduleInfo || !isEnabled}>
						edit
					</CButton>
					<CButton onClick={doDelete} color="danger" size="sm">
						delete
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
}

function processModuleStatus(status) {
	if (status) {
		switch (status.category) {
			case -1:
				return {
					message: '',
					text: 'Disabled',
					className: 'instance-status-disabled',
				}
			case 'good':
				return {
					message: status.message || '',
					text: status.level || 'OK',
					className: 'instance-status-ok',
				}
			case 'warning':
				return {
					message: status.message || '',
					text: status.level || 'Warning',
					className: 'instance-status-warn',
				}
			case 'error':
				return {
					message: status.message || '',
					text: status.level || 'ERROR',
					className: 'instance-status-error',
				}
			case null:
			default:
				return {
					message: status.message || '',
					text: 'Unknown' || '',
					className: '',
				}
		}
	}

	return {
		title: '',
		text: '',
		className: '',
	}
}
