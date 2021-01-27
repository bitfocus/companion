import { useContext, useEffect, useState } from 'react'
import { CButton } from '@coreui/react'
import { CompanionContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

import { AddModule } from './AddModule'

export function InstancesList({ configureInstance, showHelp }) {
	const context = useContext(CompanionContext)
	const [instanceStatus, setInstanceStatus] = useState({})

	useEffect(() => {
		context.socket.on('instance_status', setInstanceStatus)
		context.socket.emit('instance_status_get')

		return () => {
			context.socket.off('instance_status', setInstanceStatus)
		}
	}, [context.socket])

	return (
		<div>
			<h4>Connections / Instances</h4>
			<p>Instances are the connections companion makes to other devices and software in order to control them.</p>

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
								return ''
							} else {
								return <InstancesTableRow
									key={id}
									id={id}
									instance={instance}
									instanceStatus={instanceStatus[id]}
									showHelp={showHelp}
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

function InstancesTableRow({ id, instance, instanceStatus, showHelp, configureInstance }) {
	const context = useContext(CompanionContext)

	const moduleInfo = context.modules[instance.instance_type]

	const status = processModuleStatus(instanceStatus)
	const isEnabled = instance.enabled === undefined || instance.enabled

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
			<CButton onClick={() => {
				if (window.confirm('Delete instance?')) {
					context.socket.emit('instance_delete', id)
					configureInstance(null)
				}
			}} variant='ghost' color='danger' size='sm'>delete</CButton>
			{
				moduleInfo && (
					isEnabled
						? <CButton onClick={() => context.socket.emit('instance_enable', id, false)} variant='ghost' color='warning' size='sm'>disable</CButton>
						: <CButton onClick={() => context.socket.emit('instance_enable', id, true)} variant='ghost' color='success' size='sm'>enable</CButton>
				)
			}
			{
				moduleInfo && isEnabled
					? <CButton onClick={() => configureInstance(id)} color='primary' size='sm'>edit</CButton>
					: ''
			}
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
