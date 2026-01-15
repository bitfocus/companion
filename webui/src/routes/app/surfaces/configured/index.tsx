import { createFileRoute, Link } from '@tanstack/react-router'
import React, { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { SurfaceInstancesList } from '~/Surfaces/Instances/SurfaceInstanceList/SurfaceInstanceList'
//import { SurfacesConfig } from '~/UserConfig/Sections/SurfacesConfig'
import { PinLockoutConfig } from '~/UserConfig/Sections/PinLockoutConfig'
import { useUserConfigProps } from '~/UserConfig/Context'
import { UserConfigSwitchRow } from '~/UserConfig/Components/UserConfigSwitchRow'

export const Route = createFileRoute('/_app/surfaces/configured/')({
	component: SurfaceSettingsPanel,
})

// settings panel (shown when no configured surface is selected)
//  Shows surface user-settings and the integrations table (SurfaceInstancesList)
function SurfaceSettingsPanel() {
	const userConfigProps = useUserConfigProps()

	return (
		<>
			<EditPanelHeading />
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
						<UserConfigHeadingRow label="Surface Integrations (Plugins)" />
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

function EditPanelHeading() {
	// const { helpViewer, modules } = useContext(RootAppStoreContext)

	// const moduleInfo = modules.getModuleInfo(connectionInfo.moduleType, connectionInfo.moduleId)
	// const moduleVersion = getModuleVersionInfo(moduleInfo, connectionInfo.moduleVersionId)

	// TODO: Is there some generic help we can show here? Or go to the doc page?
	const doShowHelp = useCallback(
		() => {},
		[]
		// 		moduleVersion?.helpPath &&
		// 		helpViewer.current?.showFromUrl(
		// 			ModuleInstanceType.Connection,
		// 			connectionInfo.moduleId,
		// 			moduleVersion.versionId,
		// 			moduleVersion.helpPath
		// 		),
		// 	[helpViewer, connectionInfo.moduleId, moduleVersion]
	)

	// note that the close button is currently hidden
	const doClose = useCallback(() => {}, [])

	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Surface Settings</h4>
			<div className="header-buttons">
				<div className="float_right" onClick={doShowHelp} title="Show help for this connection">
					<FontAwesomeIcon icon={faQuestionCircle} size="lg" />
				</div>

				<div className="float_right d-xl-none" onClick={doClose} title="Close">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</div>
			</div>
		</div>
	)
}
