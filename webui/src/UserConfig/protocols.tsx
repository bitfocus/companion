import { CCol, CRow } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { memo, useState } from 'react'
import { TabArea } from '~/Components/TabArea.js'
import { ContextHelpButton } from '~/Layout/PanelIcons.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { useUserConfigProps } from './Context.js'
import { ArtnetConfig } from './Sections/ArtnetConfig.js'
import { ArtnetProtocol } from './Sections/ArtnetProtocol.js'
import { EmberPlusConfig } from './Sections/EmberPlusConfig.js'
import { EmberPlusProtocol } from './Sections/EmberPlusProtocol.js'
import { HttpConfig } from './Sections/HttpConfig.js'
import { HttpProtocol } from './Sections/HttpProtocol.js'
import { OscConfig } from './Sections/OscConfig.js'
import { OscProtocol } from './Sections/OscProtocol.js'
import { RosstalkConfig } from './Sections/RosstalkConfig.js'
import { RosstalkProtocol } from './Sections/RosstalkProtocol.js'
import { SatelliteConfig } from './Sections/SatelliteConfig.js'
import { TcpConfig } from './Sections/TcpConfig.js'
import { TcpUdpProtocol } from './Sections/TcpUdpProtocol.js'
import { UdpConfig } from './Sections/UdpConfig.js'

export const SettingsProtocolsPage = memo(function UserConfig() {
	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="d-flex justify-content-between">
							<div>
								<h4 className="btn-inline">
									Settings - Protocols
									<ContextHelpButton action="/user-guide/config/settings#protocols" />
								</h4>
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
		<TabArea.Root value={activeTab} onValueChange={setActiveTab}>
			<TabArea.List>
				<TabArea.Tab value="tcp-udp">TCP/UDP</TabArea.Tab>
				<TabArea.Tab value="http">HTTP</TabArea.Tab>
				<TabArea.Tab value="osc">OSC</TabArea.Tab>
				<TabArea.Tab value="artnet">Artnet / DMX</TabArea.Tab>
				<TabArea.Tab value="rosstalk">Rosstalk</TabArea.Tab>
				<TabArea.Tab value="emberplus">Ember+</TabArea.Tab>
				<TabArea.Indicator />
			</TabArea.List>
			<TabArea.Panel value="tcp-udp">
				<MyErrorBoundary>
					<TcpUdpProtocol />
				</MyErrorBoundary>
			</TabArea.Panel>
			<TabArea.Panel value="http">
				<MyErrorBoundary>
					<HttpProtocol />
				</MyErrorBoundary>
			</TabArea.Panel>
			<TabArea.Panel value="osc">
				<MyErrorBoundary>
					<OscProtocol />
				</MyErrorBoundary>
			</TabArea.Panel>
			<TabArea.Panel value="artnet">
				<MyErrorBoundary>
					<ArtnetProtocol />
				</MyErrorBoundary>
			</TabArea.Panel>
			<TabArea.Panel value="rosstalk">
				<MyErrorBoundary>
					<RosstalkProtocol />
				</MyErrorBoundary>
			</TabArea.Panel>
			<TabArea.Panel value="emberplus">
				<MyErrorBoundary>
					<EmberPlusProtocol />
				</MyErrorBoundary>
			</TabArea.Panel>
		</TabArea.Root>
	)
})
