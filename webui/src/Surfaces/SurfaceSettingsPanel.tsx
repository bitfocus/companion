import { faCogs } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { Table } from '~/Components/Table.js'
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
			<div className="flex items-center justify-between gap-3 p-3 bg-surface-muted/40 border-b border-border/70 shrink-0">
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-muted text-muted text-xs">
						<FontAwesomeIcon icon={faCogs} />
					</span>
					<h3 className="text-sm font-bold text-body mb-0">General Surface Settings</h3>
				</div>
				<ContextHelpButton action="/user-guide/config/settings#surfaces">
					The following settings affect all surfaces. Select an integration to configure it instead.
				</ContextHelpButton>
			</div>
			<div className="secondary-panel-simple-body space-y-4 p-4">
				{userConfigProps && (
					<Table className="table-settings rounded-md border border-border/70 bg-surface">
						<thead>
							<UserConfigHeadingRow
								label="General Surface Settings"
								helpMessage="The following settings affect all surfaces."
								helpAction="/user-guide/config/settings#surfaces"
							/>
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
