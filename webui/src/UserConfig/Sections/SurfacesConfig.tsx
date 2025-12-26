import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import type { UserConfigProps } from '../Components/Common.js'
import { CAlert } from '@coreui/react'
import { Link } from '@tanstack/react-router'

export const SurfacesConfig = observer(function SurfacesConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Surfaces" />
			<UserConfigSwitchRow userConfig={props} label="Watch for new USB Devices" field="usb_hotplug" />

			<UserConfigSwitchRow
				userConfig={props}
				label="Enable Elgato software Plugin support"
				field="elgato_plugin_enable"
			/>

			<tr>
				<td colSpan={3}>
					<CAlert color="info" className="mt-3">
						You can configure support for different types of surfaces in the{' '}
						<Link to="/surfaces/integrations">Surface Integrations</Link> page.
					</CAlert>
				</td>
			</tr>
		</>
	)
})
