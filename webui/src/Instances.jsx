import React from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { CompanionContext } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

import { AddModule } from './ModuleAdd'

export class Instances extends React.Component {
	static contextType = CompanionContext

	constructor(props) {
		super(props)

		this.state = {
			// instances
			instanceStatus: {},
		}
	}

	updateInstancesStatus = (status) => {
		this.setState({
			instanceStatus: status
		})
	}

	componentDidMount() {
		this.context.socket.on('instance_status', this.updateInstancesStatus)
		this.context.socket.emit('instance_status_get')
	}

	componentWillUnmount() {
		this.context.socket.off('instance_status', this.updateInstancesStatus)
	}

	renderInstancesTable() {
		return Object.entries(this.context.instances).filter(i => i[1].instance_type !== 'bitfocus-companion').map(([id, instance]) => {
			const moduleInfo = this.context.modules[instance.instance_type]

			const status = this.state.instanceStatus[id]
			let statusClassName = ''
			let statusText = ''
			let statusTitle = ''

			if (status) {
				switch (status[0]) {
					case -1:
						statusText = 'Disabled'
						statusClassName = 'instance-status-disabled'
						break
					case 0:
						statusText = 'OK'
						statusTitle = status[1] ?? ''
						statusClassName = 'instance-status-ok'
						break
					case 1:
						statusText = status[1] ?? ''
						statusTitle = status[1] ?? ''
						statusClassName = 'instance-status-warn'
						break
					case 2:
						statusText = 'ERROR'
						statusTitle = status[1] ?? ''
						statusClassName = 'instance-status-error'
						break
					case null:
						statusText = status[1] ?? ''
						statusTitle = status[1] ?? ''
						statusClassName = ''
						break
					default: break
				}
			}

			const isEnabled = instance.enabled === undefined || instance.enabled

			return <tr key={id}>
				<td>
					{
						moduleInfo
							? <>
								{
									moduleInfo?.help ? <div className="instance_help" onClick={() => this.props.showHelp(instance.instance_type)}><FontAwesomeIcon icon={faQuestionCircle} /></div> : ''
								}
								<b>{moduleInfo?.shortname ?? ''}</b>
								<br />
								{moduleInfo?.manufacturer ?? ''}
							</>
							: instance.instance_type
					}
				</td>
				<td>{instance.label}</td>
				<td className={statusClassName} title={statusTitle}>{statusText}</td>
				<td>
					<CButton onClick={() => {
						if (window.confirm('Delete instance?')) {
							this.context.socket.emit('instance_delete', id)
							this.props.configureInstance(null)
						}
					}} variant='ghost' color='danger'>delete</CButton>
					{
						isEnabled
							? <CButton onClick={() => this.context.socket.emit('instance_enable', id, false)} variant='ghost' color='warning'>disable</CButton>
							: <CButton onClick={() => this.context.socket.emit('instance_enable', id, true)} variant='ghost' color='success'>enable</CButton>
					}
					{
						isEnabled
							? <CButton onClick={() => this.props.configureInstance(id)} color='primary'>edit</CButton>
							: ''
					}
				</td>
			</tr>
		})

	}

	render() {
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
						{this.renderInstancesTable()}
					</tbody>
				</table>

				<AddModule showHelp={this.props.showHelp} modules={this.context.modules} configureInstance={this.props.configureInstance} />

				{/* <div class="dropdown" style="float:left">
                    <a id="dLabel" role="button" data-toggle="dropdown" class="btn btn-primary add-instance-button" data-target="#">
                            Add by category</span>
                    </a>
                    <ul class="dropdown-menu multi-level add-instance-ul" id="addInstance" role="menu" aria-labelledby="dropdownMenu">
                    </ul>
                </div>

                <div class="dropdown" style="float:left">&nbsp;
                    <a id="dLabelByManufacturer" role="button" data-toggle="dropdown" class="btn btn-primary add-instance-button" data-target="#">
                            Add by manufacturer</span>
                    </a>
                    <ul class="dropdown-menu multi-level add-instance-ul" id="addInstanceByManufacturer" role="menu" aria-labelledby="dropdownMenu">
                    </ul>
                </div>
                */}

			</div>
		)
	}
}