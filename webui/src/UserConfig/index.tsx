import React, { memo, useCallback, useContext, useState } from 'react'
import { CCol, CNav, CNavItem, CNavLink, CRow, CTabContent, CTabPane, CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHatWizard } from '@fortawesome/free-solid-svg-icons'
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
import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { UserConfigProps } from './Components/Common.js'

interface UserConfigPageProps {
	showWizard: () => void
}

export const UserConfig = memo(function UserConfig({ showWizard }: UserConfigPageProps) {
	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<div className="d-flex justify-content-between">
					<div>
						<h4>Settings</h4>
						<p>Settings apply instantaneously, don't worry about it!</p>
					</div>
					<div>
						<CButton color="primary" onClick={showWizard}>
							<FontAwesomeIcon icon={faHatWizard} /> Configuration Wizard
						</CButton>
					</div>
				</div>
				<div style={{ marginTop: -30 }}>
					<UserConfigTable />
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
	const { userConfig, socket } = useContext(RootAppStoreContext)

	const setValue = useCallback(
		(key: keyof UserConfigModel, value: any) => {
			console.log('set ', key, value)
			socket.emit('set_userconfig_key', key, value)
		},
		[socket]
	)

	const resetValue = useCallback(
		(key: keyof UserConfigModel) => {
			console.log('reset ', key)
			socket.emit('reset_userconfig_key', key)
		},
		[socket]
	)

	if (!userConfig.properties) return null

	const userConfigProps: UserConfigProps = {
		config: userConfig.properties,
		setValue,
		resetValue,
	}

	return (
		<table className="table table-responsive-sm table-settings">
			<tbody>
				<CompanionConfig {...userConfigProps} />
				<ButtonsConfig {...userConfigProps} />
				<GridConfig {...userConfigProps} />
				<SurfacesConfig {...userConfigProps} />
				<PinLockoutConfig {...userConfigProps} />

				<SatelliteConfig {...userConfigProps} />
				<TcpConfig {...userConfigProps} />
				<UdpConfig {...userConfigProps} />
				<HttpConfig {...userConfigProps} />
				<OscConfig {...userConfigProps} />
				<RosstalkConfig {...userConfigProps} />
				<EmberPlusConfig {...userConfigProps} />
				<VideohubServerConfig {...userConfigProps} />
				<ArtnetConfig {...userConfigProps} />

				<AdminPasswordConfig {...userConfigProps} />

				<HttpsConfig {...userConfigProps} />

				<ExperimentsConfig {...userConfigProps} />
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
