import { createFileRoute } from '@tanstack/react-router'
import React, { useCallback } from 'react'
import { SurfaceInstancesList } from '~/Surfaces/Instances/SurfaceInstanceList/SurfaceInstanceList'
//import { SurfacesConfig } from '~/UserConfig/Sections/SurfacesConfig'
import { PinLockoutConfig } from '~/UserConfig/Sections/PinLockoutConfig'
import { useUserConfigProps } from '~/UserConfig/Context'
import { UserConfigSwitchRow } from '~/UserConfig/Components/UserConfigSwitchRow'
import { useConfiguredSurfaceContext } from '~/Surfaces/ConfiguredSurfacesContext'
import { UserConfigHeadingRow } from '~/UserConfig/Components/UserConfigHeadingRow'
import { CloseButton, ContextHelpButton } from '~/UserConfig/Components/Common'

export const Route = createFileRoute('/_app/surfaces/configured/')({
	component: SurfaceSettingsPanel,
})

// settings panel (shown when no configured surface is selected)
//  Shows surface user-settings and the integrations table (SurfaceInstancesList)
function SurfaceSettingsPanel() {
	const userConfigProps = useUserConfigProps()

	return (
		<>
			<SettingsPanelTitleBar />
			<div className="secondary-panel-simple-body" style={{ paddingTop: '0.5em', paddingRight: '1.25em' }}>
				<p style={{ marginBottom: '0em', fontStyle: 'italic' }}>
					The following are global surface settings. To configure a known surface, select an item in the{' '}
					<strong>Configured Surfaces</strong> table to the left.
				</p>
				<hr style={{ marginTop: '0.5em', marginBottom: 0 }} />
				{userConfigProps && (
					<table className="table table-responsive-sm table-settings">
						<tbody>
							<UserConfigSwitchRow userConfig={userConfigProps} label="Watch for new USB Devices" field="usb_hotplug" />

							<UserConfigSwitchRow
								userConfig={userConfigProps}
								label="Auto-enable newly discovered surfaces"
								field="auto_enable_discovered_surfaces"
							/>
						</tbody>
					</table>
				)}

				<br />
				<table
					className="table table-responsive-sm table-settings mb-0"
					style={{ border: '1px solid var(--cui-border-color)', borderBottom: 0 }}
				>
					<thead>
						<UserConfigHeadingRow
							label="Surface Integrations (Plugins)"
							tooltip="Similar to connections, surface integrations represent the ability to use different hardware or virtual surfaces to trigger buttons in Companion."
						/>
					</thead>
					<tbody>
						<tr>
							<td style={{ borderBottom: 0 }}>
								<em>Add, configure and enable the types of surfaces you want to use.</em>
							</td>
						</tr>
					</tbody>
				</table>
				{/* Putting this in the table changes the spacing between the buttons and the integrations table, so do it this way instead... */}
				<div style={{ border: '1px solid var(--cui-border-color)', borderTop: 0 }}>
					<SurfaceInstancesList selectedInstanceId={null} toDir="configured/integration" />
					{userConfigProps && (
						<b>
							<table className="table table-responsive-sm table-settings ms-3">
								<tbody>
									<UserConfigSwitchRow
										userConfig={userConfigProps}
										label="Enable Elgato software Plugin support"
										field="elgato_plugin_enable"
									/>
								</tbody>
							</table>
						</b>
					)}
				</div>

				<br />
				{userConfigProps && (
					<table className="table table-responsive-sm table-settings">
						<tbody>
							<PinLockoutConfig {...userConfigProps} />
						</tbody>
					</table>
				)}
			</div>
		</>
	)
}

function SettingsPanelTitleBar() {
	const setPanelVisiblity = useConfiguredSurfaceContext()
	// note that the close button is currently hidden
	const doClose = useCallback(() => {
		setPanelVisiblity(false)
	}, [setPanelVisiblity])

	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Surface/Integration Settings</h4>
			<div className="header-buttons">
				<ContextHelpButton
					hoverText="Manage global surface settings and surface integrations here."
					userGuide="/user-guide/config/settings#surfaces"
				/>

				<CloseButton closeFn={doClose} visibilityClass="d-xl-none" />
			</div>
		</div>
	)
}
