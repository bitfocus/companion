import { observer } from 'mobx-react-lite'
import { StaticAlert } from '~/Components/Alert.js'
import type { UserConfigProps } from '../Components/Common.js'
import { ConfigStaticField, ConfigSwitchField } from '../Components/ConfigFieldRows.js'

export const SatelliteConfig = observer(function SatelliteConfig(props: UserConfigProps) {
	return (
		<>
			<ConfigStaticField label="TCP Port" value={16622} help="This port is fixed." />
			<ConfigStaticField label="WebSocket Port" value={16623} help="This port is fixed." />
			<ConfigSwitchField
				userConfig={props}
				label="Button Subscriptions API"
				field="satellite_subscriptions_enabled"
				help={
					<StaticAlert color="warning" className="mb-0">
						Required for full functionality from the Elgato plugin, but it allows any satellite client to bypass the
						pincode/page system and interact with any button within Companion.
					</StaticAlert>
				}
			/>
		</>
	)
})
