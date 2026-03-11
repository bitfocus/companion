import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useCallback } from 'react'
import { SurfaceInstancesList } from '~/Surfaces/Instances/SurfaceInstanceList/SurfaceInstanceList'
//import { SurfacesConfig } from '~/UserConfig/Sections/SurfacesConfig'
import { PinLockoutConfig } from '~/UserConfig/Sections/PinLockoutConfig'
import { useUserConfigProps } from '~/UserConfig/Context'
import { UserConfigSwitchRow } from '~/UserConfig/Components/UserConfigSwitchRow'
import { UserConfigHeadingRow } from '~/UserConfig/Components/UserConfigHeadingRow'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelHeaderIcons'

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
			<p style={{ marginBottom: '0em', fontStyle: 'italic', padding: '0.5em 2em' }}>
				To configure a surface integration, select an item from the table below.
				<br />
				For a specific surface, <span className="d-inline d-xl-none"> click the X button, above and </span>select it in
				the Configured Surfaces table
				<span className="d-none d-xl-inline"> to the left </span>.
			</p>
			<div className="secondary-panel-simple-body" style={{ paddingTop: 0, paddingRight: '1.25em' }}>
				<table
					className="table table-responsive-sm table-settings mb-0"
					style={{ border: '1px solid var(--cui-border-color)', borderBottom: 0 }}
				>
					<thead>
						<UserConfigHeadingRow
							label="Surface Integrations (Plugins)"
							tooltip={
								<>
									<p>
										Surface integrations are like connections: they provide the ability to use different hardware or
										virtual surfaces to trigger buttons in Companion.
									</p>
									<p>Click on any row to configure the integration.</p>
								</>
							}
						/>
					</thead>
					<tbody></tbody>
				</table>
				{/* Putting this in the table changes the spacing between the buttons and the integrations table, so do it this way instead... */}
				<div style={{ border: '1px solid var(--cui-border-color)', borderTop: 0, paddingTop: '0.5em' }}>
					<SurfaceInstancesList selectedInstanceId={null} />
					{userConfigProps && (
						<>
							<table>
								<tbody>
									<tr>
										<td>
											<div style={{ minWidth: '2em' }}></div>
										</td>
										<td style={{ width: '100%' }}>
											<table className="table table-responsive-sm table-settings elgato-plugin">
												<tbody>
													<UserConfigSwitchRow
														userConfig={userConfigProps}
														label={<strong>Enable Elgato software Plugin support</strong>}
														field="elgato_plugin_enable"
													/>
												</tbody>
											</table>
										</td>
									</tr>
								</tbody>
							</table>
						</>
					)}
				</div>

				<br />

				<p style={{ marginBottom: '0em', fontStyle: 'italic' }}>The following settings affect all surfaces.</p>
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
							<PinLockoutConfig {...userConfigProps} />
						</tbody>
					</table>
				)}
			</div>
		</>
	)
}

function SettingsPanelTitleBar() {
	const navigate = useNavigate({ from: '/surfaces/configured' })
	// note that the close button is hidden when the window is wide enough.
	const doClose = useCallback(() => {
		void navigate({ to: '.', search: { showSettings: undefined } })
	}, [navigate])

	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Surface/Integrations Settings</h4>
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
