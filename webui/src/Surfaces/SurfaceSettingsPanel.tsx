import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { Table } from '~/Components/Table.js'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
import { SurfaceInstancesList } from '~/Surfaces/Instances/SurfaceInstanceList/SurfaceInstanceList'
import { UserConfigHeadingRow } from '~/UserConfig/Components/UserConfigHeadingRow'
import { UserConfigSwitchRow } from '~/UserConfig/Components/UserConfigSwitchRow'
import { useUserConfigProps } from '~/UserConfig/Context'
import { PinLockoutConfig } from '~/UserConfig/Sections/PinLockoutConfig'

// settings panel (shown when no configured surface is selected)
//  Shows surface user-settings and the integrations table (SurfaceInstancesList)
export const SurfaceSettingsPanel = observer(function SurfaceSettingsPanel() {
	const userConfigProps = useUserConfigProps()

	return (
		<>
			<SettingsPanelTitleBar />
			<div className="secondary-panel-simple-body space-y-4 p-4">
				<p className="text-sm text-muted mb-0">
					Select an integration below to configure it. For a specific surface,{' '}
					<span className="inline xl:hidden">close this panel and </span>
					select it in Configured Surfaces<span className="hidden xl:inline"> to the left</span>.
				</p>
				<div className="rounded-md border border-border/70 bg-surface overflow-hidden">
					<SurfaceInstancesList selectedInstanceId={null} />
				</div>

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

function SettingsPanelTitleBar() {
	const navigate = useNavigate({ from: '/surfaces' })
	// note that the close button is hidden when the window is wide enough.
	const doClose = useCallback(() => {
		void navigate({ to: '/surfaces' })
	}, [navigate])

	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Surface Settings</h4>
			<div className="header-buttons">
				<ContextHelpButton action="/user-guide/surfaces">
					Manage surface integrations and global surface settings here.
				</ContextHelpButton>

				<CloseButton closeFn={doClose} visibilityClass="xl:hidden" />
			</div>
		</div>
	)
}
