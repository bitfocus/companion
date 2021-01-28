import React from 'react'
import { CAlert, CButton, CForm, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CSelect } from '@coreui/react'
import { CompanionContext, socketEmit } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faSync } from '@fortawesome/free-solid-svg-icons'

export class Surfaces extends React.Component {
	static contextType = CompanionContext

	constructor(props) {
		super(props)

		this.state = {
			devices: [],

			configureDeviceId: null,
			configureDeviceConfig: null,

			scanning: false,
			errorMsg: null,
		}
	}

	updateDevicesList = (devices) => {
		this.setState({
			devices: devices
		})
	}

	componentDidMount() {
		this.context.socket.on('devices_list', this.updateDevicesList)
		this.context.socket.emit('devices_list_get')
	}

	componentWillUnmount() {
		this.context.socket.off('devices_list', this.updateDevicesList)
	}

	refreshUSB = () => {
		this.setState({
			errorMsg: null,
			scanning: true,
		})

		socketEmit(this.context.socket, 'devices_reenumerate', [], 30000).then(([errorMsg]) => {
			this.setState({
				errorMsg: errorMsg,
				scanning: false,
			})
		}).catch(err => {
			console.error('Refresh USB failed', err)

			this.setState({
				scanning: false,
			})
		})
	}

	configureDevice = (id) => {
		this.setState({
			configureDeviceId: id,
			configureDeviceConfig: null,
		})

		socketEmit(this.context.socket, 'device_config_get', [id]).then(([err, config]) => {
			this.setState({
				configureDeviceConfig: config ?? null,
			})
		}).catch(err => {
			console.error('Failed to load device config')
		})
	}

	renderDevicesList() {
		return this.state.devices.map((dev, i) => {
			return <tr key={dev.id}>
				<td>#{i}</td>
				<td>{dev.serialnumber}</td>
				<td>{dev.type}</td>
				<td>{dev.config && dev.config.length > 0 ? <CButton color="success" onClick={() => this.configureDevice(dev.id)}><FontAwesomeIcon icon={faCog} /> Settings</CButton> : ''}</td>
			</tr>
		})
	}

	hideConfigure = () => {
		this.setState({
			configureDeviceId: null,
			configureDeviceConfig: null,
		})
	}

	updateConfig = (key, value) => {
		console.log('update', key, value)
		if (this.state.configureDeviceId) {
			const newConfig = {
				...this.state.configureDeviceConfig,
				[key]: value,
			}
			this.setState({
				configureDeviceConfig: newConfig,
			})
			this.context.socket.emit('device_config_set', this.state.configureDeviceId, newConfig)
		}
	}

	renderConfigureDeviceContent(device) {
		const config = this.state.configureDeviceConfig
		if (!device || !config) {
			return "Loading..."
		} else {
			return <CForm>
				{
					device?.config?.includes('brightness')
						? <CFormGroup>
							<CLabel htmlFor="brightness">Brightness</CLabel>
							<CInput name="brightness" type="range" min={0} max={100} step={1} value={config.brightness} onChange={(e) => this.updateConfig('brightness', parseInt(e.currentTarget.value))} />
						</CFormGroup>
						: ''
				}

				{
					device?.config?.includes('orientation')
						? <CFormGroup>
							<CLabel htmlFor="orientation">Button rotation</CLabel>
							<CSelect name="orientation" value={config.rotation} onChange={(e) => this.updateConfig('rotation', parseInt(e.currentTarget.value))}>
								<option value="0">Normal</option>
								<option value="-90">90 CCW</option>
								<option value="90">90 CW</option>
								<option value="180">180</option>
							</CSelect>
						</CFormGroup>
						: ''
				}

				{
					device?.config?.includes('page')
						? <CFormGroup>
							<CLabel htmlFor="page">Page</CLabel>
							<CInput name="page" type="range" min={1} max={99} step={1} value={config.page} onChange={(e) => this.updateConfig('page', parseInt(e.currentTarget.value))} />
							<span>{config.page}</span>
						</CFormGroup>
						: ''
				}

				{
					device?.config?.includes('keysPerRow')
						? <CFormGroup>
							<CLabel htmlFor="keysPerRow">Keys per row</CLabel>
							<CInput name="keysPerRow" type="range" min={1} max={99} step={1} value={config.keysPerRow} onChange={(e) => this.updateConfig('keysPerRow', parseInt(e.currentTarget.value))} />
							<span>{config.keysPerRow}</span>
						</CFormGroup>
						: ''
				}

				{
					device?.config?.includes('keysPerColumn')
						? <CFormGroup>
							<CLabel htmlFor="keysPerColumn">Keys per column</CLabel>
							<CInput name="keysPerColumn" type="range" min={1} max={99} step={1} value={config.keysPerColumn} onChange={(e) => this.updateConfig('keysPerColumn', parseInt(e.currentTarget.value))} />
							<span>{config.keysPerColumn}</span>
						</CFormGroup>
						: ''
				}
			</CForm>
		}
	}

	render() {
		const configureDevice = this.state.configureDeviceId ? this.state.devices.find(dev => dev.id === this.state.configureDeviceId) : null
		return (
			<div>
				<h4>Connected devices</h4>
				<p>These are the surfaces currently connected to companion. If your streamdeck is missing from this list, you
                might need to close the Elgato Streamdeck application and click the Rescan button below.</p><p><i>Rescanning blocks all operations while the scan is ongoing. <b>Use with care!</b></i></p>
				<CAlert color="warning" role="alert" style={{ display: this.state.errorMsg ? '' : 'none' }}>{this.state.errorMsg}</CAlert>

				<CModal show={!!this.state.configureDeviceId} onClose={this.hideConfigure}>
					<CModalHeader closeButton>
						<h5>Settings for {configureDevice?.type}</h5>
					</CModalHeader>
					<CModalBody>
						{this.renderConfigureDeviceContent(configureDevice)}
					</CModalBody>
					<CModalFooter>
						<CButton
							color="secondary"
							onClick={this.hideConfigure}
						>Close</CButton>
					</CModalFooter>
				</CModal>


				<table className="table table-responsive-sm">
					<thead>
						<tr>
							<th>NO</th>
							<th>ID</th>
							<th>Type</th>
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{this.renderDevicesList()}
					</tbody>
				</table>

				<CButton color="warning" onClick={this.refreshUSB}>
					<FontAwesomeIcon icon={faSync} spin={this.state.scanning} />
					{
						this.state.scanning
							? ' Checking for new devices...'
							: ' Rescan USB'
					}
				</CButton>
			</div>
		)
	}
}