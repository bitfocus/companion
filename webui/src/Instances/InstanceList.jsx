import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CButton } from '@coreui/react'
import { InstancesContext, VariableDefinitionsContext, socketEmitPromise, SocketContext, ModulesContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faQuestionCircle, faBug } from '@fortawesome/free-solid-svg-icons'
import jsonPatch from 'fast-json-patch'

import { InstanceVariablesModal } from './InstanceVariablesModal'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { cloneDeep } from 'lodash-es'

export function InstancesList({ showHelp, doConfigureInstance }) {
	const socket = useContext(SocketContext)
	const instancesContext = useContext(InstancesContext)

	const [instanceStatus, setInstanceStatus] = useState({})

	const deleteModalRef = useRef()
	const variablesModalRef = useRef()

	useEffect(() => {
		socketEmitPromise(socket, 'instance_status:get', [])
			.then((statuses) => {
				setInstanceStatus(statuses)
			})
			.catch((e) => {
				console.error(`Failed to load instance statuses`, e)
			})

		const patchStatuses = (patch) => {
			setInstanceStatus((oldStatuses) => {
				return jsonPatch.applyPatch(cloneDeep(oldStatuses) || {}, patch).newDocument
			})
		}
		socket.on('instance_status:patch', patchStatuses)

		return () => {
			socket.off('instance_status:patch', patchStatuses)
		}
	}, [socket])

	const doShowVariables = useCallback((instanceId) => {
		variablesModalRef.current.show(instanceId)
	}, [])

	return (
		<div>
			<h4>Connections</h4>
			<p>
				When you want to control devices or software with Companion, you need to add a connection to let Companion know
				how to communicate with whatever you want to control.
			</p>

			<GenericConfirmModal ref={deleteModalRef} />
			<InstanceVariablesModal ref={variablesModalRef} />

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>Module</th>
						<th>Label</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(instancesContext).map(([id, instance]) => {
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
					})}
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
				<p>{status.text}</p>
				<p>{typeof status.message === 'string' ? status.message : JSON.stringify(status.message)}</p>
			</td>
			<td className="action-buttons">
				<CButton onClick={doDelete} variant="ghost" color="danger" size="sm">
					delete
				</CButton>
				{isEnabled ? (
					<CButton onClick={doToggleEnabled} variant="ghost" color="warning" size="sm" disabled={!moduleInfo}>
						disable
					</CButton>
				) : (
					<CButton onClick={doToggleEnabled} variant="ghost" color="success" size="sm" disabled={!moduleInfo}>
						enable
					</CButton>
				)}
				<CButton onClick={() => configureInstance(id)} color="primary" size="sm" disabled={!moduleInfo || !isEnabled}>
					edit
				</CButton>
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
