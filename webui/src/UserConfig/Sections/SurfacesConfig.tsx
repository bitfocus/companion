import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const SurfacesConfig = observer(function SurfacesConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Surfaces" />

			<UserConfigSwitchRow
				userConfig={props}
				label="Watch for new USB Devices"
				field="usb_hotplug"
				title="Automatically scan for new devices when they are plugged in."
			/>

			<UserConfigSwitchRow
				userConfig={props}
				label="Auto-enable newly discovered surfaces"
				field="auto_enable_discovered_surfaces"
			/>
		</>
	)
})
