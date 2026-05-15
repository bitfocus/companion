import { observer } from 'mobx-react-lite'
import { StaticAlert } from '~/Components/Alert.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigStaticTextRow } from '../Components/UserConfigStaticTextRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const SatelliteConfig = observer(function SatelliteConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Satellite" />

			<UserConfigStaticTextRow label="Satellite TCP Listen Port" text={16622} textHelp="You can't change this value." />

			<UserConfigStaticTextRow
				label="Satellite Websocket Listen Port"
				text={16623}
				textHelp="You can't change this value."
			/>

			<UserConfigSwitchRow
				userConfig={props}
				label="Enable Button Subscriptions API"
				field="satellite_subscriptions_enabled"
			/>

			<tr>
				<td colSpan={3}>
					<StaticAlert color="warning">
						The Subscriptions API is required for full functionality from the Elgato plugin, but enabling it allows any
						satellite client to bypass the pincode/page system and interact with any button within Companion
					</StaticAlert>
				</td>
			</tr>
		</>
	)
})
