import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { CompanionContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

import { AddModule } from './AddModule'

export function InstancesList({ configureInstance, showHelp }) {
	const context = useContext(CompanionContext)
	const [instanceStatus, setInstanceStatus] = useState({})

	const deleteModalRef = useRef()

	useEffect(() => {
		context.socket.on('instance_status', setInstanceStatus)
		context.socket.emit('instance_status_get')

		return () => {
			context.socket.off('instance_status', setInstanceStatus)
		}
	}, [context.socket])

	const doDelete = useCallback((instanceId) => {
		context.socket.emit('instance_delete', instanceId)
		configureInstance(null)
	}, [context.socket, configureInstance])

	return (
		<div>
			<h4>Connections / Instances</h4>
			<p>Instances are the connections companion makes to other devices and software in order to control them.</p>

			<ConfirmDeleteModal ref={deleteModalRef} doDelete={doDelete} />

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
					{
						Object.entries(context.instances).map(([id, instance]) => {
							if (instance.instance_type === 'bitfocus-companion') {
								return null
							} else {
								return <InstancesTableRow
									key={id}
									id={id}
									instance={instance}
									instanceStatus={instanceStatus[id]}
									showHelp={showHelp}
									deleteModalRef={deleteModalRef}
									configureInstance={configureInstance}
								/>
							}
						})
					}
				</tbody>
			</table>

			<AddModule showHelp={showHelp} modules={context.modules} configureInstance={configureInstance} />

		</div>
	)
}

function InstancesTableRow({ id, instance, instanceStatus, showHelp, configureInstance, deleteModalRef }) {
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

	return <tr>
		<td>
			{
				moduleInfo
					? <>
						{
							moduleInfo?.help ? <div className="instance_help" onClick={() => showHelp(instance.instance_type)}><FontAwesomeIcon icon={faQuestionCircle} /></div> : ''
						}
						<b>{moduleInfo?.shortname ?? ''}</b>
						<br />
						{moduleInfo?.manufacturer ?? ''}
					</>
					: instance.instance_type
			}
		</td>
		<td>{instance.label}</td>
		<td className={status.className} title={status.title}>{status.text}</td>
		<td className='action-buttons'>
			<CButton onClick={doDelete} variant='ghost' color='danger' size='sm'>delete</CButton>
			{
				isEnabled
					? <CButton onClick={doToggleEnabled} variant='ghost' color='warning' size='sm' disabled={!moduleInfo}>disable</CButton>
					: <CButton onClick={doToggleEnabled} variant='ghost' color='success' size='sm' disabled={!moduleInfo}>enable</CButton>
			}
			<CButton onClick={() => configureInstance(id)} color='primary' size='sm' disabled={!moduleInfo || !isEnabled}>edit</CButton>
		</td>
	</tr>
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

const ConfirmDeleteModal = forwardRef(function ConfirmDeleteModal({ doDelete }, ref) {
	const [data, setData] = useState(null)
	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setData(null), [])
	const doDelete2 = useCallback(() => {
		setData(null)
		doDelete(data?.[0])
	},[data, doDelete])

	useImperativeHandle(ref, () => ({
		show(id, name) {
			setData([id, name])
			setShow(true)
		}
	}), [])

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>Delete instance</h5>
			</CModalHeader>
			<CModalBody>

				<p>Are you sure you want to delete "{data?.[1]}"?</p>

			</CModalBody>
			<CModalFooter>
				<CButton
					color="secondary"
					onClick={doClose}
				>Cancel</CButton>
				<CButton
					color="primary"
					onClick={doDelete2}
				>Delete</CButton>
			</CModalFooter>
		</CModal>
	)
})
