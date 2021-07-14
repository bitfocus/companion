import React, { memo, useCallback, useContext } from 'react'
import {
	CButton,
	CCol,
	CInput,
	CInputCheckbox,
	CNav,
	CNavItem,
	CNavLink,
	CRow,
	CTabContent,
	CTabPane,
	CTabs,
} from '@coreui/react'
import { MyErrorBoundary, StaticContext, UserConfigContext } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'

export const UserConfig = memo(function UserConfig() {
	return (
		<CRow>
			<CCol xl={6}>
				<h4>Settings</h4>
				<p>Settings applies instantaneously, don't worry about it!</p>

				<UserConfigTable />
			</CCol>
			<CCol xs={12} xl={6} className="secondary-panel">
				<h4>Remote control</h4>
				<p>Companion can be remote controlled in several ways. Below you'll find how to do it.</p>
				<div className="secondary-panel-inner">
					<RemoteControlInfo />
				</div>
			</CCol>
		</CRow>
	)
})

function UserConfigTable() {
	const context = useContext(StaticContext)
	const config = useContext(UserConfigContext)

	const setValue = useCallback(
		(key, value) => {
			console.log('set ', key, value)
			context.socket.emit('set_userconfig_key', key, value)
		},
		[context.socket]
	)

	return (
		<table className="table table-responsive-sm">
			<thead>
				<tr>
					<th>Setting</th>
					<th>Value</th>
				</tr>
			</thead>

			<tbody>
				<tr>
					<td colSpan="2" className="settings-category">
						Navigation Buttons
					</td>
				</tr>

				<tr>
					<td>Flip counting direction on page up/down</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_page_direction_flipped"
								checked={config.page_direction_flipped}
								onChange={(e) => setValue('page_direction_flipped', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_page_direction_flipped">
								Enabled
							</label>
						</div>
					</td>
				</tr>

				<tr>
					<td>Show + and - instead of arrows on page buttons</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_page_plusminus"
								checked={config.page_plusminus}
								onChange={(e) => setValue('page_plusminus', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_page_plusminus">
								Enabled
							</label>
						</div>
					</td>
				</tr>

				<tr>
					<td>Remove the topbar on each button</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_remove_topbar"
								checked={config.remove_topbar}
								onChange={(e) => setValue('remove_topbar', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_remove_topbar">
								Enabled
							</label>
						</div>
					</td>
				</tr>

				<tr>
					<td colSpan="2" className="settings-category">
						Devices
					</td>
				</tr>
				<tr>
					<td>Enable emulator control for Logitec R400/Mastercue/dSan</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_emulator_control_enable"
								checked={config.emulator_control_enable}
								onChange={(e) => setValue('emulator_control_enable', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_emulator_control_enable">
								Enabled
							</label>
						</div>
					</td>
				</tr>
				<tr>
					<td colSpan="2" className="settings-category">
						PIN Lockout
					</td>
				</tr>
				<tr>
					<td>Enable Pin Codes</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_pin_enable"
								checked={config.pin_enable}
								onChange={(e) => setValue('pin_enable', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_pin_enable">
								Enabled
							</label>
						</div>
					</td>
				</tr>

				<tr>
					<td>Link Lockouts</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_link_lockouts"
								checked={config.link_lockouts}
								onChange={(e) => setValue('link_lockouts', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_link_lockouts">
								Enabled
							</label>
						</div>
					</td>
				</tr>

				<tr>
					<td>Pin Code</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput type="text" value={config.pin} onChange={(e) => setValue('pin', e.currentTarget.value)} />
						</div>
					</td>
				</tr>

				<tr>
					<td>Pin Timeout (seconds, 0 to turn off)</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInput
								type="number"
								value={config.pin_timeout}
								onChange={(e) => setValue('pin_timeout', e.currentTarget.value)}
							/>
						</div>
					</td>
				</tr>

				<tr>
					<td colSpan="2" className="settings-category">
						TCP
					</td>
				</tr>
				<tr>
					<td>TCP Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_tcp_enabled"
								checked={config.tcp_enabled}
								onChange={(e) => setValue('tcp_enabled', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_tcp_enabled">
								Enabled
							</label>
						</div>
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
				</tr>

				<tr>
					<td colSpan="2" className="settings-category">
						UDP
					</td>
				</tr>
				<tr>
					<td>UDP Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_udp_enabled"
								checked={config.udp_enabled}
								onChange={(e) => setValue('udp_enabled', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_udp_enabled">
								Enabled
							</label>
						</div>
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
				</tr>

				<tr>
					<td colSpan="2" className="settings-category">
						OSC
					</td>
				</tr>
				<tr>
					<td>OSC Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_osc_enabled"
								checked={config.osc_enabled}
								onChange={(e) => setValue('osc_enabled', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_osc_enabled">
								Enabled
							</label>
						</div>
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
				</tr>

				<tr>
					<td colSpan="2" className="settings-category">
						RossTalk
					</td>
				</tr>
				<tr>
					<td>RossTalk Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_rosstalk_enabled"
								checked={config.rosstalk_enabled}
								onChange={(e) => setValue('rosstalk_enabled', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_rosstalk_enabled">
								Enabled
							</label>
						</div>
					</td>
				</tr>
				<tr>
					<td colSpan="2" className="settings-category">
						Artnet Listener
					</td>
				</tr>
				<tr>
					<td>Artnet Listener</td>
					<td>
						<div className="form-check form-check-inline mr-1">
							<CInputCheckbox
								id="userconfig_artnet_enabled"
								checked={config.artnet_enabled}
								onChange={(e) => setValue('artnet_enabled', e.currentTarget.checked)}
							/>
							<label className="form-check-label" htmlFor="userconfig_artnet_enabled">
								Enabled
							</label>
						</div>
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
									<code>BANK-PRESS</code> &lt;page&gt; &lt;bank&gt;
									<br />
									<i>Press and release a button (run both down and up actions)</i>
								</li>
								<li>
									<code>BANK-DOWN</code> &lt;page&gt; &lt;bank&gt;
									<br />
									<i>Press the button (run down actions)</i>
								</li>
								<li>
									<code>BANK-UP</code> &lt;page&gt; &lt;bank&gt;
									<br />
									<i>Release the button (run up actions)</i>
								</li>
								<li>
									<code>STYLE BANK</code> &lt;page&gt; &lt;bank&gt;<code> TEXT </code>
									&lt;text&gt;
									<br />
									<i>Change text on a button</i>
								</li>
								<li>
									<code>STYLE BANK</code> &lt;page&gt; &lt;bank&gt;
									<code> COLOR </code>&lt;color HEX&gt;
									<br />
									<i>Change text color on a button (#000000)</i>
								</li>
								<li>
									<code>STYLE BANK</code> &lt;page&gt; &lt;bank&gt;
									<code> BGCOLOR </code>&lt;color HEX&gt;
									<br />
									<i>Change background color on a button (#000000)</i>
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
								Press page 1 bank 2
								<br />
								<code>BANK-PRESS 1 2</code>
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
								<ul>
									<li>
										<code>/press/bank/</code>&lt;page&gt;<code>/</code>&lt;bank&gt;
										<br />
										<i>Press and release a button (run both down and up actions)</i>
									</li>
									<li>
										<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;bank&gt;
										<code>?bgcolor=</code>&lt;bgcolor HEX&gt;
										<br />
										<i>Change background color of button</i>
									</li>
									<li>
										<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;bank&gt;
										<code>?color=</code>&lt;color HEX&gt;
										<br />
										<i>Change color of text on button</i>
									</li>
									<li>
										<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;bank&gt;
										<code>?text=</code>&lt;text&gt;
										<br />
										<i>Change text on a button</i>
									</li>
									<li>
										<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;bank&gt;
										<code>?size=</code>&lt;text size&gt;
										<br />
										<i>Change text size on a button (between the predefined values)</i>
									</li>
								</ul>
							</p>

							<p>
								<strong>Examples</strong>
							</p>

							<p>
								Press page 1 bank 2
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
									<code>/press/bank/</code>&lt;page&gt; &lt;bank&gt;
									<br />
									<i>Press and release a button (run both down and up actions)</i>
								</li>
								<li>
									<code>/press/bank/</code> &lt;page&gt; &lt;bank&gt; &lt;1&gt;
									<br />
									<i>Press the button (run down actions and hold)</i>
								</li>
								<li>
									<code>/press/bank/</code> &lt;page&gt; &lt;bank&gt; &lt;0&gt;
									<br />
									<i>Release the button (run up actions)</i>
								</li>
								<li>
									<code>/style/bgcolor/</code> &lt;page&gt; &lt;bank&gt; &lt;red 0-255&gt; &lt;green 0-255&gt; &lt;blue
									0-255&gt;
									<br />
									<i>Change background color of button</i>
								</li>
								<li>
									<code>/style/color/</code> &lt;page&gt; &lt;bank&gt; &lt;red 0-255&gt; &lt;green 0-255&gt; &lt;blue
									0-255&gt;
									<br />
									<i>Change color of text on button</i>
								</li>
								<li>
									<code>/style/text/</code> &lt;page&gt; &lt;bank&gt; &lt;text&gt;
									<br />
									<i>Change text on a button</i>
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
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="artnet">
						<MyErrorBoundary>
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
								Remote triggering can be done by sending RossTalk commands to port <code>7788</code>.
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
