import React, { memo, useCallback, useContext, useState } from 'react'
import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane } from '@coreui/react'
import { MyErrorBoundary } from '../util.js'
import { ArtnetProtocol } from './ArtnetProtocol.js'
import { RosstalkProtocol } from './RosstalkProtocol.js'
import { OscProtocol } from './OscProtocol.js'
import { HttpProtocol } from './HttpProtocol.js'
import { TcpUdpProtocol } from './TcpUdpProtocol.js'
import { HttpsConfig } from './HttpsConfig.js'
import { SurfacesConfig } from './SurfacesConfig.js'
import { PinLockoutConfig } from './PinLockoutConfig.js'
import { ButtonsConfig } from './ButtonsConfig.js'
import { ExperimentsConfig } from './ExperimentsConfig.js'
import { AdminPasswordConfig } from './AdminPasswordConfig.js'
import { EmberPlusConfig } from './EmberPlusConfig.js'
import { SatelliteConfig } from './SatelliteConfig.js'
import { TcpConfig } from './TcpConfig.js'
import { UdpConfig } from './UdpConfig.js'
import { OscConfig } from './OscConfig.js'
import { RosstalkConfig } from './RosstalkConfig.js'
import { ArtnetConfig } from './ArtnetConfig.js'
import { GridConfig } from './GridConfig.js'
import { VideohubServerConfig } from './VideohubServerConfig.js'
import { HttpConfig } from './HttpConfig.js'
import { CompanionConfig } from './CompanionConfig.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

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

const UserConfigTable = observer(function UserConfigTable() {
	const { userConfig, socket } = useContext(RootAppStoreContext)

	const setValue = useCallback(
		(key: string, value: any) => {
			console.log('set ', key, value)
			socket.emit('set_userconfig_key', key, value)
		},
		[socket]
	)

	const resetValue = useCallback(
		(key: string) => {
			console.log('reset ', key)
			socket.emit('reset_userconfig_key', key)
		},
		[socket]
	)

	if (!userConfig.properties) return null

	return (
		<table className="table table-responsive-sm">
			<tbody>
				<CompanionConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<ButtonsConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<GridConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<SurfacesConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<PinLockoutConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />

				<SatelliteConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<TcpConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<UdpConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<HttpConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<OscConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<RosstalkConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<EmberPlusConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<VideohubServerConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
				<ArtnetConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />

				<AdminPasswordConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />

				<HttpsConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />

				<ExperimentsConfig config={userConfig.properties} setValue={setValue} resetValue={resetValue} />
			</tbody>
		</table>
	)
})

const RemoteControlInfo = memo(function RemoteControlInfo() {
	const [activeTab, setActiveTab] = useState<'tcp-udp' | 'http' | 'osc' | 'artnet' | 'rosstalk'>('tcp-udp')

	return (
		<>
			<CNav variant="tabs" role="tablist" className="remote-control-tabs">
				<CNavItem>
					<CNavLink active={activeTab === 'tcp-udp'} onClick={() => setActiveTab('tcp-udp')}>
						TCP/UDP
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink active={activeTab === 'http'} onClick={() => setActiveTab('http')}>
						HTTP
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink active={activeTab === 'osc'} onClick={() => setActiveTab('osc')}>
						OSC
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink active={activeTab === 'artnet'} onClick={() => setActiveTab('artnet')}>
						Artnet / DMX
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink active={activeTab === 'rosstalk'} onClick={() => setActiveTab('rosstalk')}>
						Rosstalk
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane role="tabpanel" aria-labelledby="tcp-udp-tab" visible={activeTab === 'tcp-udp'}>
					<MyErrorBoundary>
						<TcpUdpProtocol />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane role="tabpanel" aria-labelledby="http-tab" visible={activeTab === 'http'}>
					<MyErrorBoundary>
						<HttpProtocol />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane role="tabpanel" aria-labelledby="osc-tab" visible={activeTab === 'osc'}>
					<MyErrorBoundary>
						<OscProtocol />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane role="tabpanel" aria-labelledby="artnet-tab" visible={activeTab === 'artnet'}>
					<MyErrorBoundary>
						<ArtnetProtocol />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane role="tabpanel" aria-labelledby="rosstalk-tab" visible={activeTab === 'rosstalk'}>
					<MyErrorBoundary>
						<RosstalkProtocol />
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
})
