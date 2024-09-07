import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from './Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from './Components/UserConfigSwitchRow.js'
import { UserConfigProps } from './Components/Common.js'

export const SurfacesConfig = observer(function SurfacesConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Surfaces" />
			<UserConfigSwitchRow userConfig={props} label="Watch for new USB Devices" field="usb_hotplug" />

			<UserConfigSwitchRow
				userConfig={props}
				label="Watch for Discoverable Companion Satellite Installations"
				field="discoveryEnabled"
			/>

			<UserConfigSwitchRow
				userConfig={props}
				label={
					<>
						Enable connected Streamdecks
						<br />
						When disabled support for the Elgato software Plugin will be enabled
					</>
				}
				requiresRestart
				field="elgato_plugin_enable"
			/>
			<UserConfigSwitchRow userConfig={props} label="Enable connected X-keys" requiresRestart field="xkeys_enable" />
			<UserConfigSwitchRow
				userConfig={props}
				label="Use old layout for X-keys"
				requiresRestart
				field="xkeys_legacy_layout"
			/>
			<UserConfigSwitchRow
				userConfig={props}
				label="Enable connected Loupedeck and Razer Stream Controller devices"
				requiresRestart
				field="loupedeck_enable"
			/>
			<UserConfigSwitchRow
				userConfig={props}
				label="Enable connected Contour Shuttle"
				requiresRestart
				field="contour_shuttle_enable"
			/>
			<UserConfigSwitchRow
				userConfig={props}
				label="Enable connected VEC Footpedal"
				requiresRestart
				field="vec_footpedal_enable"
			/>
			<UserConfigSwitchRow
				userConfig={props}
				label={
					<>
						Enable connected Blackmagic Atem Micro Panel
						<br />
						<em>You must not run the Atem software at the same time</em>
					</>
				}
				requiresRestart
				field="blackmagic_controller_enable"
			/>
		</>
	)
})
