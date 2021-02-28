import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { CompanionContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

import { InstanceVariablesModal } from './InstanceVariablesModal'

export function InstancesList({ showHelp, doConfigureInstance }) {
	const context = useContext(CompanionContext)
	const [instanceStatus, setInstanceStatus] = useState({})

	const deleteModalRef = useRef()
	const variablesModalRef = useRef()

	useEffect(() => {
		context.socket.on('instance_status', setInstanceStatus)
		context.socket.emit('instance_status_get')

		return () => {
			context.socket.off('instance_status', setInstanceStatus)
		}
	}, [context.socket])

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

			<ConfirmDeleteModal ref={deleteModalRef} />
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
					{Object.entries(context.instances).map(([id, instance]) => {
						if (instance.instance_type === 'bitfocus-companion') {
							return null
						} else {
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
						}
					})}
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
	const context = useContext(CompanionContext)

	const moduleInfo = context.modules[instance.instance_type]

	const status = processModuleStatus(instanceStatus)
	const isEnabled = instance.enabled === undefined || instance.enabled

	const doDelete = useCallback(() => {
		deleteModalRef.current.show(id, instance.label)
	}, [deleteModalRef, id, instance.label])

	const doToggleEnabled = useCallback(() => {
		context.socket.emit('instance_enable', id, !isEnabled)
	}, [context.socket, id, isEnabled])

	const doShowHelp = useCallback(() => showHelp(instance.instance_type), [showHelp, instance.instance_type])

	const doShowVariables = useCallback(() => showVariables(instance.label), [showVariables, instance.label])

	const instanceVariables = context.variableDefinitions[instance.label]

	return (
		<tr>
			<td>
				{moduleInfo ? (
					<>
						{moduleInfo?.help ? (
							<div className="instance_help" onClick={doShowHelp} title="Help">
								<FontAwesomeIcon icon={faQuestionCircle} />
							</div>
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
				{instanceVariables && instanceVariables.length > 0 ? (
					<div className="instance_variables" onClick={doShowVariables} title="Variables">
						<FontAwesomeIcon icon={faDollarSign} />
					</div>
				) : (
					''
				)}
				{instance.label}
			</td>
			<td className={status.className} title={status.title}>
				{status.text}
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
		switch (status[0]) {
			case -1:
				return {
					title: '',
					text: 'Disabled',
					className: 'instance-status-disabled',
				}
			case 0:
				return {
					title: status[1] ?? '',
					text: 'OK',
					className: 'instance-status-ok',
				}
			case 1:
				return {
					title: status[1] ?? '',
					text: status[1] ?? '',
					className: 'instance-status-warn',
				}
			case 2:
				return {
					title: status[1] ?? '',
					text: 'ERROR',
					className: 'instance-status-error',
				}
			case null:
				return {
					title: status[1] ?? '',
					text: status[1] ?? '',
					className: '',
				}
			default:
				break
		}
	}

	return {
		title: '',
		text: '',
		className: '',
	}
}

const ConfirmDeleteModal = forwardRef(function ConfirmDeleteModal(_props, ref) {
	const context = useContext(CompanionContext)

	const [data, setData] = useState(null)
	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setData(null), [])
	const doDelete = useCallback(() => {
		setData(null)
		setShow(false)

		// Perform the delete
		context.socket.emit('instance_delete', data?.[0])
	}, [data, context.socket])

	useImperativeHandle(
		ref,
		() => ({
			show(id, name) {
				setData([id, name])
				setShow(true)
			},
		}),
		[]
	)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>Delete instance</h5>
			</CModalHeader>
			<CModalBody>
				<p>Are you sure you want to delete "{data?.[1]}"?</p>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton color="primary" onClick={doDelete}>
					Delete
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
