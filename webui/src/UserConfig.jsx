import React, { memo, useCallback, useContext } from 'react'
import {
	CAlert,
	CButton,
	CCol,
	CDropdown,
	CDropdownItem,
	CDropdownMenu,
	CDropdownToggle,
	CInput,
	CNav,
	CNavItem,
	CNavLink,
	CRow,
	CTabContent,
	CTabPane,
	CTabs,
} from '@coreui/react'
import { MyErrorBoundary, SocketContext, UserConfigContext } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileImport, faSync, faTrash, faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from './CSwitch'

export const UserConfig = memo(function UserConfig() {
	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<h4>Settings</h4>
				<p>Settings apply instantaneously, don't worry about it!</p>

				<UserConfigTable />
			</CCol>
			<CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-header">
					<h4>Remote control</h4>
					<p>Companion can be remote controlled in several ways. Below you'll find how to do it.</p>
				</div>
				<div className="secondary-panel-inner">
					<RemoteControlInfo />
				</div>
			</CCol>
		</CRow>
	)
})

function UserConfigTable() {
	const socket = useContext(SocketContext)
	const config = useContext(UserConfigContext)

	const setValue = useCallback(
		(key, value) => {
			console.log('set ', key, value)
			socket.emit('set_userconfig_key', key, value)
		},
		[socket]
	)

	const resetValue = useCallback(
		(key) => {
			console.log('reset ', key)
			socket.emit('reset_userconfig_key', key)
		},
		[socket]
	)

	const createSslCertificate = useCallback(() => {
		console.log('create SSL certificate')
		socket.emit('ssl_certificate_create')
	}, [socket])

	const deleteSslCertificate = useCallback(() => {
		console.log('delete SSL certificate')
		socket.emit('ssl_certificate_delete')
	}, [socket])

	const renewSslCertificate = useCallback(() => {
		console.log('renew SSL certificate')
		socket.emit('ssl_certificate_renew')
	}, [socket])

	return (
		<table className="table table-responsive-sm">
			<tbody>
				<tr>
					<th colSpan="0" className="settings-category">
						Buttons
					</th>
					<th className="fit"></th>
					<th></th>
				</tr>

				<tr>
					<td>Flip counting direction on page up/down buttons</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.page_direction_flipped}
								size={'lg'}
								onChange={(e) => setValue('page_direction_flipped', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('page_direction_flipped')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>Show + and - instead of arrows on page up/down buttons</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.page_plusminus}
								size={'lg'}
								onChange={(e) => setValue('page_plusminus', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('page_plusminus')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>Show the topbar on each button. This can be overridden per-button</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={!config.remove_topbar}
								size={'lg'}
								onChange={(e) => setValue('remove_topbar', !e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('remove_topbar')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						Surfaces
					</th>
				</tr>
				<tr>
					<td>Watch for new USB Devices</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.usb_hotplug}
								size={'lg'}
								onChange={(e) => setValue('usb_hotplug', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('usb_hotplug')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>
						Enable connected Streamdecks
						<br />
						When disabled support for the Elgato software Plugin will be enabled
						<br />
						<em>(Requires Companion restart)</em>
					</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={!config.elgato_plugin_enable}
								size={'lg'}
								onChange={(e) => setValue('elgato_plugin_enable', !e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('elegato_plugin_enable')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>
						Enable connected X-keys
						<br />
						<em>(Requires Companion restart)</em>
					</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.xkeys_enable}
								size={'lg'}
								onChange={(e) => setValue('xkeys_enable', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('xkeys_enable')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>
						Enable connected Loupedeck and Razer Stream Controller devices
						<br />
						<em>(Requires Companion restart)</em>
					</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.loupedeck_enable}
								size={'lg'}
								onChange={(e) => setValue('loupedeck_enable', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('loupedeck_enable')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<th colSpan="3" className="settings-category">
						PIN Lockout
					</th>
				</tr>
				<tr>
					<td>Enable Pin Codes</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.pin_enable}
								size={'lg'}
								onChange={(e) => setValue('pin_enable', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('pin_enable')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>Link Lockouts</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.link_lockouts}
								size={'lg'}
								onChange={(e) => setValue('link_lockouts', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('link_lockouts')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>Pin Code</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput type="text" value={config.pin} onChange={(e) => setValue('pin', e.currentTarget.value)} />
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('pin')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>Pin Timeout (seconds, 0 to turn off)</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.pin_timeout}
								min={0}
								step={1}
								onChange={(e) => setValue('pin_timeout', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('pin_timeout')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						Satellite
					</th>
				</tr>
				<tr>
					<td>Satellite Listen Port</td>
					<td>16622</td>
					<td></td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						TCP
					</th>
				</tr>
				<tr>
					<td>TCP Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.tcp_enabled}
								size={'lg'}
								onChange={(e) => setValue('tcp_enabled', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('tcp_enabled')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>TCP Listen Port</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.tcp_listen_port}
								onChange={(e) => setValue('tcp_listen_port', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('tcp_listen_port')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						UDP
					</th>
				</tr>
				<tr>
					<td>UDP Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.udp_enabled}
								size={'lg'}
								onChange={(e) => setValue('udp_enabled', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('udp_enabled')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>UDP Listen Port</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.udp_listen_port}
								onChange={(e) => setValue('udp_listen_port', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('udp_listen_port')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						OSC
					</th>
				</tr>
				<tr>
					<td>OSC Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.osc_enabled}
								size={'lg'}
								onChange={(e) => setValue('osc_enabled', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('osc_enabled')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>OSC Listen Port</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.osc_listen_port}
								onChange={(e) => setValue('osc_listen_port', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('osc_listen_port')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						RossTalk
					</th>
				</tr>
				<tr>
					<td>RossTalk Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.rosstalk_enabled}
								size={'lg'}
								onChange={(e) => setValue('rosstalk_enabled', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('rosstalk_enabled')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>Rosstalk Listen Port</td>
					<td>7788</td>
					<td></td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						Ember+
					</th>
				</tr>
				<tr>
					<td>Ember+ Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.emberplus_enabled}
								size={'lg'}
								onChange={(e) => setValue('emberplus_enabled', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('emberplus_enabled')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>Ember+ Listen Port</td>
					<td>9092</td>
					<td></td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						Artnet Listener
					</th>
				</tr>
				<tr>
					<td>Artnet Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.artnet_enabled}
								size={'lg'}
								onChange={(e) => setValue('artnet_enabled', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('artnet_enabled')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>Artnet Universe (first is 0)</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.artnet_universe}
								onChange={(e) => setValue('artnet_universe', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('artnet_universe')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>Artnet Channel</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.artnet_channel}
								onChange={(e) => setValue('artnet_channel', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('artnet_channel')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						Admin UI Password
					</th>
				</tr>
				<tr>
					<td colSpan="3">
						<CAlert color="danger">
							This does not make an installation secure!
							<br /> This is intended to keep normal users from stumbling upon the settings and changing things. It will
							not keep out someone determined to bypass it.
						</CAlert>
					</td>
				</tr>
				<tr>
					<td>Enable Locking</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.admin_lockout}
								size={'lg'}
								onChange={(e) => setValue('admin_lockout', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('admin_lockout')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>Session Timeout (minutes, 0 for no timeout)</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.admin_timeout}
								min={0}
								step={1}
								onChange={(e) => setValue('admin_timeout', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('admin_timeout')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>
				<tr>
					<td>Password</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="text"
								value={config.admin_password}
								onChange={(e) => setValue('admin_password', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('admin_password')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<th colSpan="3" className="settings-category">
						HTTPS Web Server
					</th>
				</tr>
				<tr>
					<td colSpan="3">
						<p>An HTTPS server can be enabled for the Companion web interfaces should your deployment require it.</p>
						<CAlert color="danger">
							It is never recommended to expose the Companion interface to the Internet and HTTPS does not provide any
							additional security for that configuration.
						</CAlert>
					</td>
				</tr>
				<tr>
					<td>HTTPS Web Server</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={config.https_enabled}
								size={'lg'}
								onChange={(e) => setValue('https_enabled', e.currentTarget.checked)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('https_enabled')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>HTTPS Port</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.https_port}
								onChange={(e) => setValue('https_port', e.currentTarget.value)}
							/>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('https_port')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				<tr>
					<td>Certificate Type</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CDropdown className="mt-2" style={{ display: 'inline-block' }}>
								<CDropdownToggle>{config.https_cert_type === 'external' ? 'External' : 'Self Signed'}</CDropdownToggle>
								<CDropdownMenu>
									<CDropdownItem onClick={() => setValue('https_cert_type', 'self')}>Self Signed</CDropdownItem>
									<CDropdownItem onClick={() => setValue('https_cert_type', 'external')}>External</CDropdownItem>
								</CDropdownMenu>
							</CDropdown>
						</div>
					</td>
					<td>
						<CButton onClick={() => resetValue('https_cert_type')} title="Reset to default">
							<FontAwesomeIcon icon={faUndo} />
						</CButton>
					</td>
				</tr>

				{config.https_cert_type === 'self' && (
					<tr>
						<td colSpan="3">
							<table className="table table-responsive-sm">
								<tbody>
									<tr>
										<td colSpan="3">This tool will help create a self-signed certificate for the server to use.</td>
									</tr>

									<tr>
										<td>Common Name (Domain Name)</td>
										<td>
											<div className="form-check form-check-inline mr-1">
												<CInput
													type="text"
													value={config.https_self_cn}
													onChange={(e) => setValue('https_self_cn', e.currentTarget.value)}
												/>
											</div>
										</td>
										<td>
											<CButton onClick={() => resetValue('https_self_cn')} title="Reset to default">
												<FontAwesomeIcon icon={faUndo} />
											</CButton>
										</td>
									</tr>
									<tr>
										<td>Certificate Expiry Days</td>
										<td>
											<div className="form-check form-check-inline mr-1">
												<CInput
													type="number"
													value={config.https_self_expiry}
													onChange={(e) => setValue('https_self_expiry', e.currentTarget.value)}
												/>
											</div>
										</td>
										<td>
											<CButton onClick={() => resetValue('https_self_expiry')} title="Reset to default">
												<FontAwesomeIcon icon={faUndo} />
											</CButton>
										</td>
									</tr>
									<tr>
										<td>
											Certificate Details
											<br />
											{config.https_self_cert && config.https_self_cert.length > 0 ? (
												<ul>
													<li>Common Name: {config.https_self_cert_cn}</li>
													<li>Created: {config.https_self_cert_created}</li>
													<li>Expiry Period: {config.https_self_cert_expiry}</li>
												</ul>
											) : (
												<ul>
													<li>No certificate available</li>
												</ul>
											)}
										</td>
										<td>
											{config.https_self_cert && config.https_self_cert.length > 0 ? (
												<p>
													<CButton onClick={() => renewSslCertificate()} color="success" className="mb-2">
														<FontAwesomeIcon icon={faSync} />
														&nbsp;Renew
													</CButton>
													<br />
													<CButton onClick={() => deleteSslCertificate()} color="danger">
														<FontAwesomeIcon icon={faTrash} />
														&nbsp;Delete
													</CButton>
												</p>
											) : (
												<CButton onClick={() => createSslCertificate()} color="success">
													<FontAwesomeIcon icon={faSync} />
													&nbsp;Generate
												</CButton>
											)}
										</td>
										<td>&nbsp;</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				)}

				{config.https_cert_type === 'external' && (
					<tr>
						<td colSpan="3">
							<table className="table table-responsive-sm">
								<tbody>
									<tr>
										<td colSpan="3">
											<p>
												This requires you to generate your own self-signed certificate or go through a certificate
												authority. A properly signed certificate will work.
											</p>
											<CAlert color="danger">
												This option is provided as-is. Support will not be provided for this feature. <br />
												DO NOT POST GITHUB ISSUES IF THIS DOES NOT WORK.
											</CAlert>
										</td>
									</tr>

									<tr>
										<td>Private Key File (full path)</td>
										<td>
											<div className="form-check form-check-inline mr-1">
												<CInput
													type="text"
													value={config.https_ext_private_key}
													onChange={(e) => setValue('https_ext_private_key', e.currentTarget.value)}
												/>
											</div>
										</td>
										<td>
											<CButton onClick={() => resetValue('https_ext_private_key')} title="Reset to default">
												<FontAwesomeIcon icon={faUndo} />
											</CButton>
										</td>
									</tr>

									<tr>
										<td>Certificate File (full path)</td>
										<td>
											<div className="form-check form-check-inline mr-1">
												<CInput
													type="text"
													value={config.https_ext_certificate}
													onChange={(e) => setValue('https_ext_certificate', e.currentTarget.value)}
												/>
											</div>
										</td>
										<td>
											<CButton onClick={() => resetValue('https_ext_certificate')} title="Reset to default">
												<FontAwesomeIcon icon={faUndo} />
											</CButton>
										</td>
									</tr>

									<tr>
										<td>
											Chain File (full path)
											<br />
											*Optional
										</td>
										<td>
											<div className="form-check form-check-inline mr-1">
												<CInput
													type="text"
													value={config.https_ext_chain}
													onChange={(e) => setValue('https_ext_chain', e.currentTarget.value)}
												/>
											</div>
										</td>
										<td>
											<CButton onClick={() => resetValue('https_ext_chain')} title="Reset to default">
												<FontAwesomeIcon icon={faUndo} />
											</CButton>
										</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				)}
				<tr>
					<th colSpan="3" className="settings-category">
						Experiments
					</th>
				</tr>
				<tr>
					<td colSpan="3">
						<CAlert color="danger">Do not touch these settings unless you know what you are doing!</CAlert>
					</td>
				</tr>
				<tr>
					<td>Use TouchBackend for Drag and Drop</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={window.localStorage.getItem('test_touch_backend') === '1'}
								size={'lg'}
								onChange={(e) => {
									window.localStorage.setItem('test_touch_backend', e.currentTarget.checked ? '1' : '0')
									window.location.reload()
								}}
							/>
						</div>
					</td>
					<td>&nbsp;</td>
				</tr>
				<tr>
					<td>Companion Cloud Tab</td>
					<td>
						<div className="form-check form-check-inline mr-1 float-right">
							<CSwitch
								color="success"
								checked={window.localStorage.getItem('show_companion_cloud') === '1'}
								size={'lg'}
								onChange={(e) => {
									window.localStorage.setItem('show_companion_cloud', e.currentTarget.checked ? '1' : '0')
									window.location.reload()
								}}
							/>
						</div>
					</td>
					<td>&nbsp;</td>
				</tr>
			</tbody>
		</table>
	)
}

function RemoteControlInfo() {
	const config = useContext(UserConfigContext)

	return (
		<>
			<CTabs activeTab="tcp-udp">
				<CNav variant="tabs">
					<CNavItem>
						<CNavLink data-tab="tcp-udp">TCP/UDP</CNavLink>
					</CNavItem>
					<CNavItem>
						<CNavLink data-tab="http">HTTP</CNavLink>
					</CNavItem>
					<CNavItem>
						<CNavLink data-tab="osc">OSC</CNavLink>
					</CNavItem>
					<CNavItem>
						<CNavLink data-tab="artnet">Artnet / DMX</CNavLink>
					</CNavItem>
					<CNavItem>
						<CNavLink data-tab="rosstalk">Rosstalk</CNavLink>
					</CNavItem>
				</CNav>
				<CTabContent fade={false}>
					<CTabPane data-tab="tcp-udp">
						<MyErrorBoundary>
							<p>
								Remote triggering can be done by sending TCP (port{' '}
								<code>
									{config?.tcp_enabled && config?.tcp_listen_port && config?.tcp_listen_port !== '0'
										? config?.tcp_listen_port
										: 'disabled'}
								</code>
								) or UDP (port{' '}
								<code>
									{config?.udp_enabled && config?.udp_listen_port && config?.udp_listen_port !== '0'
										? config?.udp_listen_port
										: 'disabled'}
								</code>
								) commands.
							</p>
							<p>
								<strong>Commands:</strong>
							</p>
							<ul>
								<li>
									<code>PAGE-SET</code> &lt;page number&gt; &lt;surface id&gt;
									<br />
									<i>Make device go to a specific page</i>
								</li>
								<li>
									<code>PAGE-UP</code> &lt;surface id&gt;
									<br />
									<i>Page up on a specific device</i>
								</li>
								<li>
									<code>PAGE-DOWN</code> &lt;surface id&gt;
									<br />
									<i>Page down on a specific surface</i>
								</li>
								<li>
									<code>BANK-PRESS</code> &lt;page&gt; &lt;button&gt;
									<br />
									<i>Press and release a button (run both down and up actions)</i>
								</li>
								<li>
									<code>BANK-DOWN</code> &lt;page&gt; &lt;button&gt;
									<br />
									<i>Press the button (run down actions)</i>
								</li>
								<li>
									<code>BANK-UP</code> &lt;page&gt; &lt;button&gt;
									<br />
									<i>Release the button (run up actions)</i>
								</li>
								<li>
									<code>STYLE BANK</code> &lt;page&gt; &lt;button&gt;<code> TEXT </code>
									&lt;text&gt;
									<br />
									<i>Change text on a button</i>
								</li>
								<li>
									<code>STYLE BANK</code> &lt;page&gt; &lt;button&gt;
									<code> COLOR </code>&lt;color HEX&gt;
									<br />
									<i>Change text color on a button (#000000)</i>
								</li>
								<li>
									<code>STYLE BANK</code> &lt;page&gt; &lt;button&gt;
									<code> BGCOLOR </code>&lt;color HEX&gt;
									<br />
									<i>Change background color on a button (#000000)</i>
								</li>
								<li>
									<code>CUSTOM-VARIABLE</code> &lt;name&gt; <code>SET-VALUE</code> &lt;value&gt;
									<br />
									<i>Change custom variable value</i>
								</li>
								<li>
									<code>RESCAN</code>
									<br />
									<i>Make Companion rescan for newly attached USB surfaces</i>
								</li>
							</ul>

							<p>
								<strong>Examples</strong>
							</p>

							<p>
								Set the emulator surface to page 23
								<br />
								<code>PAGE-SET 23 emulator</code>
							</p>

							<p>
								Press page 1 button 2
								<br />
								<code>BANK-PRESS 1 2</code>
							</p>

							<p>
								Change custom variable &quot;cue&quot; to value &quot;intro&quot;
								<br />
								<code>CUSTOM-VARIABLE cue SET-VALUE intro</code>
							</p>
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="http">
						<MyErrorBoundary>
							<p>
								Remote triggering can be done by sending HTTP Requests to the same IP and port Companion is running on.
							</p>
							<p>
								<strong>Commands:</strong>
							</p>
							<ul>
								<li>
									<code>/press/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
									<br />
									<i>Press and release a button (run both down and up actions)</i>
								</li>
								<li>
									<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
									<code>?bgcolor=</code>&lt;bgcolor HEX&gt;
									<br />
									<i>Change background color of button</i>
								</li>
								<li>
									<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
									<code>?color=</code>&lt;color HEX&gt;
									<br />
									<i>Change color of text on button</i>
								</li>
								<li>
									<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
									<code>?text=</code>&lt;text&gt;
									<br />
									<i>Change text on a button</i>
								</li>
								<li>
									<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
									<code>?size=</code>&lt;text size&gt;
									<br />
									<i>Change text size on a button (between the predefined values)</i>
								</li>
								<li>
									<code>/set/custom-variable/</code>&lt;name&gt;<code>?value=</code>&lt;value&gt;
									<br />
									<i>Change custom variable value</i>
								</li>
								<li>
									<code>/rescan</code>
									<br />
									<i>Make Companion rescan for newly attached USB surfaces</i>
								</li>
							</ul>

							<p>
								<strong>Examples</strong>
							</p>

							<p>
								Press page 1 button 2
								<br />
								<code>/press/bank/1/2</code>
							</p>

							<p>
								Change the text of button 4 on page 2 to TEST
								<br />
								<code>/style/bank/2/4/?text=TEST</code>
							</p>

							<p>
								Change the text of button 4 on page 2 to TEST, background color to #ffffff, text color to #000000 and
								font size to 28px
								<br />
								<code>/style/bank/2/4/?text=TEST&bgcolor=%23ffffff&color=%23000000&size=28px</code>
							</p>

							<p>
								Change custom variable &quot;cue&quot; to value &quot;intro&quot;
								<br />
								<code>/set/custom-variable/cue?value=intro</code>
							</p>
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="osc">
						<MyErrorBoundary>
							<p>
								Remote triggering can be done by sending OSC commands to port{' '}
								<code>
									{config?.osc_enabled && config?.osc_listen_port && config?.osc_listen_port !== '0'
										? config?.osc_listen_port
										: 'disabled'}
								</code>
								.
							</p>
							<p>
								<strong>Commands:</strong>
							</p>
							<ul>
								<li>
									<code>/press/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
									<br />
									<i>Press and release a button (run both down and up actions)</i>
								</li>
								<li>
									<code>/press/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;1&gt;
									<br />
									<i>Press the button (run down actions and hold)</i>
								</li>
								<li>
									<code>/press/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;0&gt;
									<br />
									<i>Release the button (run up actions)</i>
								</li>
								<li>
									<code>/style/bgcolor/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;red 0-255&gt; &lt;green
									0-255&gt; &lt;blue 0-255&gt;
									<br />
									<i>Change background color of button</i>
								</li>
								<li>
									<code>/style/color/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;red 0-255&gt; &lt;green
									0-255&gt; &lt;blue 0-255&gt;
									<br />
									<i>Change color of text on button</i>
								</li>
								<li>
									<code>/style/text/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;text&gt;
									<br />
									<i>Change text on a button</i>
								</li>
								<li>
									<code>/custom-variable/</code>&lt;name&gt;<code>/value</code> &lt;value&gt;
									<br />
									<i>Change custom variable value</i>
								</li>
								<li>
									<code>/rescan</code> 1
									<br />
									<i>Make Companion rescan for newly attached USB surfaces</i>
								</li>
							</ul>

							<p>
								<strong>Examples</strong>
							</p>

							<p>
								Press button 5 on page 1 down and hold
								<br />
								<code>/press/bank/1/5 1</code>
							</p>

							<p>
								Change button background color of button 5 on page 1 to red
								<br />
								<code>/style/bgcolor/1/5 255 0 0</code>
							</p>

							<p>
								Change the text of button 5 on page 1 to ONLINE
								<br />
								<code>/style/text/1/5 ONLINE</code>
							</p>

							<p>
								Change custom variable &quot;cue&quot; to value &quot;intro&quot;
								<br />
								<code>/custom-variable/cue/value intro</code>
							</p>
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="artnet">
						<MyErrorBoundary>
							<p>
								<CButton color="success" href="/Bitfocus_Companion_v20.d4" target="_new">
									<FontAwesomeIcon icon={faFileImport} /> Download Avolites Fixture file (v2.0)
								</CButton>
							</p>
							<p>
								<CButton color="success" href="/bitfocus@companion_v2.0@00.xml" target="_new">
									<FontAwesomeIcon icon={faFileImport} /> Download GrandMA2 Fixture file (v2.0)
								</CButton>
							</p>
							<p>
								<CButton color="success" href="/Bitfocus Companion Fixture.v3f" target="_new">
									<FontAwesomeIcon icon={faFileImport} /> Download Vista Fixture file (v2.0)
								</CButton>
							</p>
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="rosstalk">
						<MyErrorBoundary>
							<p>
								Remote triggering can be done by sending RossTalk commands to port{' '}
								<code>{config?.rosstalk_enabled ? '7788' : 'disabled'}</code>.
							</p>
							<p>
								<strong>Commands:</strong>
							</p>
							<ul>
								<li>
									<code>CC</code> &lt;page&gt;:&lt;button&gt;
									<br />
									<i>Press and release button</i>
								</li>
							</ul>

							<p>
								<strong>Examples</strong>
							</p>

							<p>
								Press and release button 5 on page 2
								<br />
								<code>CC 2:5</code>
							</p>
						</MyErrorBoundary>
					</CTabPane>
				</CTabContent>
			</CTabs>
		</>
	)
}
