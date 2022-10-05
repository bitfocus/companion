import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { InstancesContext, VariableDefinitionsContext, socketEmitPromise, SocketContext, ModulesContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faQuestionCircle, faBug } from '@fortawesome/free-solid-svg-icons'
import { InstanceVariablesModal } from './InstanceVariablesModal'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import CSwitch from '../CSwitch'

export function InstancesList({ showHelp, doConfigureInstance, instanceStatus }) {
	const instancesContext = useContext(InstancesContext)

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

	const visibleConnectionsData = Object.entries(instancesContext).filter(([id, instance]) => {
		const status = instanceStatus[id]

		if (!visibleConnections.disabled && (!status || !status.category)) {
			return false
		} else if (status) {
			if (!visibleConnections.ok && status.category === 'good') {
				return false
			} else if (!visibleConnections.warning && status.category === 'warning') {
				return false
			} else if (!visibleConnections.error && status.category === 'error') {
				return false
			}
		}

		return true
	})

	const rows = visibleConnectionsData.map(([id, instance]) => {
		return (
			<InstancesTableRow
				key={id}
				id={id}
				instance={instance}
				instanceStatus={instanceStatus[id]}
				showHelp={showHelp}
				showVariables={doShowVariables}
				deleteModalRef={deleteModalRef}
				configureInstance={doConfigureInstance}
			/>
		)
	})
	const hiddenCount = Object.keys(instancesContext).length - rows.length

	console.log(rows)

	return (
		<div>
			<h4>Connections</h4>
			<p>
				When you want to control devices or software with Companion, you need to add a connection to let Companion know
				how to communicate with whatever you want to control.
			</p>

			<GenericConfirmModal ref={deleteModalRef} />
			<InstanceVariablesModal ref={variablesModalRef} />

			<p>
				Show:
				<CButtonGroup>
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
			</p>

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>Module</th>
						<th>Label</th>
						<th>Status</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{rows}
					{hiddenCount > 0 ? (
						<tr>
							<td colSpan={4}>{hiddenCount} Connections are hidden</td>
						</tr>
					) : (
						''
					)}
					{Object.keys(instancesContext).length === 0 ? (
						<tr>
							<td colSpan={4}>
								You haven't setup any connections yet. <br />
								Try adding something from the list <span className="d-xl-none">below</span>
								<span className="d-none d-xl-inline">to the right</span>.
							</td>
						</tr>
					) : (
						''
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

	const instanceVariables = variableDefinitionsContext[instance.label]

	return (
		<tr>
			<td>
				{moduleInfo ? (
					<>
						{moduleInfo?.hasHelp ? (
							<div className="instance_help" onClick={doShowHelp} title="Help">
								<FontAwesomeIcon icon={faQuestionCircle} />
							</div>
						) : (
							''
						)}
						{moduleInfo?.bugUrl ? (
							<a className="instance_bug" href={moduleInfo.bugUrl} target="_new" title="Report Bug">
								<FontAwesomeIcon icon={faBug} />
							</a>
						) : (
							''
						)}

						<b>{moduleInfo?.shortname ?? ''}</b>
						<br />
						{moduleInfo?.manufacturer ?? ''}
					</>
				) : (
					instance.instance_type
				)}
			</td>
			<td>
				{instanceVariables && Object.keys(instanceVariables).length > 0 ? (
					<div className="instance_variables" onClick={doShowVariables} title="Variables">
						<FontAwesomeIcon icon={faDollarSign} />
					</div>
				) : (
					''
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
