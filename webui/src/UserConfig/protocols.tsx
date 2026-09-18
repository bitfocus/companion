import { faCog, faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { memo, useState } from 'react'
import { TabArea } from '~/Components/TabArea.js'
import { Table } from '~/Components/Table.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PageIntro } from '~/Layout/PageIntro'
import { ContextHelpButton } from '~/Layout/PanelIcons.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { useUserConfigProps } from './Context.js'
import { ArtnetConfig } from './Sections/ArtnetConfig.js'
import { ArtnetProtocol } from './Sections/ArtnetProtocol.js'
import { EmberPlusConfig } from './Sections/EmberPlusConfig.js'
import { EmberPlusProtocol } from './Sections/EmberPlusProtocol.js'
import { HttpConfig } from './Sections/HttpConfig.js'
import { HttpProtocol } from './Sections/HttpProtocol.js'
import { MetricsConfig } from './Sections/MetricsConfig.js'
import { OscConfig } from './Sections/OscConfig.js'
import { OscProtocol } from './Sections/OscProtocol.js'
import { RestApiConfig } from './Sections/RestApiConfig.js'
import { RosstalkConfig } from './Sections/RosstalkConfig.js'
import { RosstalkProtocol } from './Sections/RosstalkProtocol.js'
import { SatelliteConfig } from './Sections/SatelliteConfig.js'
import { TcpConfig } from './Sections/TcpConfig.js'
import { TcpUdpProtocol } from './Sections/TcpUdpProtocol.js'
import { UdpConfig } from './Sections/UdpConfig.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsProtocolsPage = memo(function UserConfig() {
	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#protocols" />

			<div className="page-shell-body">
				<SettingsNav activeTab="protocols" />

				<div className="page-scroll">
					<div className="primary-panel space-y-6 pb-8">
						<div>
							<PageIntro
								title="Protocols Settings"
								titleSuffix={<ContextHelpButton action="/user-guide/config/settings#protocols" />}
							>
								Enable or disable network remote control endpoints for TCP, UDP, HTTP, OSC, Artnet, and Satellite.
							</PageIntro>
							<div className="surface-card">
								<UserConfigTable />
							</div>
						</div>

						<div className="surface-card">
							<div className="flex items-center gap-3 p-4 bg-surface-muted/40 border-b border-border/70">
								<span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-muted text-muted text-sm">
									<FontAwesomeIcon icon={faNetworkWired} />
								</span>
								<div>
									<h4 className="text-base font-bold text-body mb-0.5">Remote Control API Reference</h4>
									<p className="text-xs text-muted mb-0">
										Companion can be controlled remotely over several protocols. Select a protocol tab below to view
										command syntax and endpoint documentation.
									</p>
								</div>
							</div>
							<div className="p-4">
								<RemoteControlInfo />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
})

const UserConfigTable = observer(function UserConfigTable() {
	const userConfigProps = useUserConfigProps()
	if (!userConfigProps) return null

	return (
		<Table className="table-settings">
			<tbody>
				<SatelliteConfig {...userConfigProps} />
				<TcpConfig {...userConfigProps} />
				<UdpConfig {...userConfigProps} />
				<HttpConfig {...userConfigProps} />
				<RestApiConfig {...userConfigProps} />
				<MetricsConfig {...userConfigProps} />
				<OscConfig {...userConfigProps} />
				<RosstalkConfig {...userConfigProps} />
				<EmberPlusConfig {...userConfigProps} />
				<ArtnetConfig {...userConfigProps} />
			</tbody>
		</Table>
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
