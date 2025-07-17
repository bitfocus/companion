import React, { memo, useState } from 'react'
import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane } from '@coreui/react'
import { EmberPlusConfig } from './Sections/EmberPlusConfig.js'
import { SatelliteConfig } from './Sections/SatelliteConfig.js'
import { TcpConfig } from './Sections/TcpConfig.js'
import { UdpConfig } from './Sections/UdpConfig.js'
import { OscConfig } from './Sections/OscConfig.js'
import { RosstalkConfig } from './Sections/RosstalkConfig.js'
import { ArtnetConfig } from './Sections/ArtnetConfig.js'
import { VideohubServerConfig } from './Sections/VideohubServerConfig.js'
import { HttpConfig } from './Sections/HttpConfig.js'
import { observer } from 'mobx-react-lite'
import { MyErrorBoundary } from '~/util.js'
import { ArtnetProtocol } from './Sections/ArtnetProtocol.js'
import { HttpProtocol } from './Sections/HttpProtocol.js'
import { OscProtocol } from './Sections/OscProtocol.js'
import { RosstalkProtocol } from './Sections/RosstalkProtocol.js'
import { EmberPlusProtocol } from './Sections/EmberPlusProtocol.js'
import { TcpUdpProtocol } from './Sections/TcpUdpProtocol.js'
import { useUserConfigProps } from './Context.js'

export const SettingsProtocolsPage = memo(function UserConfig() {
	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="d-flex justify-content-between">
							<div>
								<h4>Settings - Protocols</h4>
								<p>Settings apply instantaneously, don't worry about it!</p>
							</div>
						</div>
					</div>
					<div className="scrollable-content">
						<UserConfigTable />
					</div>
				</div>
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
	const userConfigProps = useUserConfigProps()
	if (!userConfigProps) return null

	return (
		<table className="table table-responsive-sm table-settings">
			<tbody>
				<SatelliteConfig {...userConfigProps} />
				<TcpConfig {...userConfigProps} />
				<UdpConfig {...userConfigProps} />
				<HttpConfig {...userConfigProps} />
				<OscConfig {...userConfigProps} />
				<RosstalkConfig {...userConfigProps} />
				<EmberPlusConfig {...userConfigProps} />
				<VideohubServerConfig {...userConfigProps} />
				<ArtnetConfig {...userConfigProps} />
			</tbody>
		</table>
	)
})

const RemoteControlInfo = memo(function RemoteControlInfo() {
	const [activeTab, setActiveTab] = useState<'tcp-udp' | 'http' | 'osc' | 'artnet' | 'rosstalk' | 'emberplus'>(
		'tcp-udp'
	)

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
				<CNavItem>
					<CNavLink active={activeTab === 'emberplus'} onClick={() => setActiveTab('emberplus')}>
						Ember+
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
				<CTabPane role="tabpanel" aria-labelledby="emberplus-tab" visible={activeTab === 'emberplus'}>
					<MyErrorBoundary>
						<EmberPlusProtocol />
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
})
