import { useNavigate } from '@tanstack/react-router'
import React, { useCallback } from 'react'
import { SurfaceInstancesList } from '~/Surfaces/Instances/SurfaceInstanceList/SurfaceInstanceList'
import { PinLockoutConfig } from '~/UserConfig/Sections/PinLockoutConfig'
import { useUserConfigProps } from '~/UserConfig/Context'
import { UserConfigSwitchRow } from '~/UserConfig/Components/UserConfigSwitchRow'
import { UserConfigHeadingRow } from '~/UserConfig/Components/UserConfigHeadingRow'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelHeaderIcons'
import { observer } from 'mobx-react-lite'

// settings panel (shown when no configured surface is selected)
//  Shows surface user-settings and the integrations table (SurfaceInstancesList)
export const SurfaceSettingsPanel = observer(function SurfaceSettingsPanel() {
	const userConfigProps = useUserConfigProps()

	return (
		<>
			<SettingsPanelTitleBar />
			<p style={{ marginBottom: '0em', padding: '0.5em 2em' }}>
				To configure a surface integration, select an item from the table below.
				<br />
				For a specific surface, <span className="d-inline d-xl-none"> click the X button, above and </span>select it in
				the Configured Surfaces table
				<span className="d-none d-xl-inline"> to the left </span>.
			</p>
			<div className="secondary-panel-simple-body" style={{ paddingTop: 0, paddingRight: '1.25em' }}>
				{/* Putting this in the table changes the spacing between the buttons and the integrations table, so do it this way instead... */}
				<div>
					<SurfaceInstancesList selectedInstanceId={null} />
					{userConfigProps && (
						<>
							<div className="d-flex" style={{ border: '1px solid var(--cui-border-color)', borderTop: 0 }}>
								<span style={{ paddingRight: 'calc(1.5em + 10px)' }}> </span>
								<span className="d-inline" style={{ width: '100%' }}>
									<table className="table table-responsive-sm table-settings elgato-plugin">
										<tbody>
											<UserConfigSwitchRow
												userConfig={userConfigProps}
												label={<strong>Enable Elgato software Plugin support</strong>}
												field="elgato_plugin_enable"
											/>
										</tbody>
									</table>
								</span>
							</div>
						</>
					)}
				</div>

				<br />

				{userConfigProps && (
					<table className="table table-responsive-sm table-settings">
						<thead>
							<UserConfigHeadingRow
								label="General Surface Settings"
								tooltip="The following settings affect all surfaces."
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
					</table>
				)}
			</div>
		</>
	)
})

function SettingsPanelTitleBar() {
	const navigate = useNavigate({ from: '/surfaces/configured' })
	// note that the close button is hidden when the window is wide enough.
	const doClose = useCallback(() => {
		void navigate({ to: '/surfaces/configured' })
	}, [navigate])

	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Surface Integrations and General Settings</h4>
			<div className="header-buttons">
				<ContextHelpButton
					hoverText="Manage surface integrations and global surface settings here."
					help="/user-guide/config/settings#surfaces"
				/>

				<CloseButton closeFn={doClose} visibilityClass="d-xl-none" />
			</div>
		</div>
	)
}
