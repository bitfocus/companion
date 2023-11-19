import React, { memo, useCallback, useContext } from 'react'
import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane, CTabs } from '@coreui/react'
import { MyErrorBoundary, SocketContext, UserConfigContext } from '../util'
import { ArtnetProtocol } from './ArtnetProtocol'
import { RosstalkProtocol } from './RosstalkProtocol'
import { OscProtocol } from './OscProtocol'
import { HttpProtocol } from './HttpProtocol'
import { TcpUdpProtocol } from './TcpUdpProtocol'
import { HttpsConfig } from './HttpsConfig'
import { SurfacesConfig } from './SurfacesConfig'
import { PinLockoutConfig } from './PinLockoutConfig'
import { ButtonsConfig } from './ButtonsConfig'
import { ExperimentsConfig } from './ExperimentsConfig'
import { AdminPasswordConfig } from './AdminPasswordConfig'
import { EmberPlusConfig } from './EmberPlusConfig'
import { SatelliteConfig } from './SatelliteConfig'
import { TcpConfig } from './TcpConfig'
import { UdpConfig } from './UdpConfig'
import { OscConfig } from './OscConfig'
import { RosstalkConfig } from './RosstalkConfig'
import { ArtnetConfig } from './ArtnetConfig'
import { GridConfig } from './GridConfig'
import { VideohubServerConfig } from './VideohubServerConfig'
import { HttpConfig } from './HttpConfig'

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

	if (!config) return null

	return (
		<table className="table table-responsive-sm">
			<tbody>
				<ButtonsConfig config={config} setValue={setValue} resetValue={resetValue} />
				<GridConfig config={config} setValue={setValue} resetValue={resetValue} />
				<SurfacesConfig config={config} setValue={setValue} resetValue={resetValue} />
				<PinLockoutConfig config={config} setValue={setValue} resetValue={resetValue} />

				<SatelliteConfig config={config} setValue={setValue} resetValue={resetValue} />
				<TcpConfig config={config} setValue={setValue} resetValue={resetValue} />
				<UdpConfig config={config} setValue={setValue} resetValue={resetValue} />
				<HttpConfig config={config} setValue={setValue} resetValue={resetValue} />
				<OscConfig config={config} setValue={setValue} resetValue={resetValue} />
				<RosstalkConfig config={config} setValue={setValue} resetValue={resetValue} />
				<EmberPlusConfig config={config} setValue={setValue} resetValue={resetValue} />
				<VideohubServerConfig config={config} setValue={setValue} resetValue={resetValue} />
				<ArtnetConfig config={config} setValue={setValue} resetValue={resetValue} />

				<AdminPasswordConfig config={config} setValue={setValue} resetValue={resetValue} />

				<HttpsConfig config={config} setValue={setValue} resetValue={resetValue} />

				<ExperimentsConfig config={config} setValue={setValue} resetValue={resetValue} />
			</tbody>
		</table>
	)
}

function RemoteControlInfo() {
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
							<TcpUdpProtocol />
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="http">
						<MyErrorBoundary>
							<HttpProtocol />
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="osc">
						<MyErrorBoundary>
							<OscProtocol />
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="artnet">
						<MyErrorBoundary>
							<ArtnetProtocol />
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="rosstalk">
						<MyErrorBoundary>
							<RosstalkProtocol />
						</MyErrorBoundary>
					</CTabPane>
				</CTabContent>
			</CTabs>
		</>
	)
}
