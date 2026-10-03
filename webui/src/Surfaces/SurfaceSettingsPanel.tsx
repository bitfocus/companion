import { faCogs } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { Table } from '~/Components/Table.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { ContextHelpButton } from '~/Layout/PanelIcons'
import { UserConfigHeadingRow } from '~/UserConfig/Components/UserConfigHeadingRow'
import { UserConfigSwitchRow } from '~/UserConfig/Components/UserConfigSwitchRow'
import { useUserConfigProps } from '~/UserConfig/Context'
import { PinLockoutConfig } from '~/UserConfig/Sections/PinLockoutConfig'

/** The integrations page's secondary panel while no integration is selected: the global surface settings. */
export const SurfaceSettingsPanel = observer(function SurfaceSettingsPanel() {
	const userConfigProps = useUserConfigProps()

	return (
		<>
			<PanelHeader icon={faCogs} title="General Surface Settings">
				<ContextHelpButton action="/user-guide/config/settings#surfaces">
					The following settings affect all surfaces. Select an integration to configure it instead.
				</ContextHelpButton>
			</PanelHeader>
			<div className="secondary-panel-simple-body space-y-4 p-4">
				{userConfigProps && (
					<Table className="table-settings rounded-md border border-border/70 bg-surface">
						<thead>
							<UserConfigHeadingRow label="General Surface Settings" />
						</thead>
						<tbody>
							<UserConfigSwitchRow
								userConfig={userConfigProps}
								label="Watch for new USB Devices"
								field="usb_hotplug"
								title="Automatically scan for new devices when they are plugged in."
							/>

							<UserConfigSwitchRow
								userConfig={userConfigProps}
								label="Auto-enable newly discovered surfaces"
								field="auto_enable_discovered_surfaces"
							/>
							<PinLockoutConfig {...userConfigProps} />
						</tbody>
					</Table>
				)}
			</div>
		</>
	)
})
