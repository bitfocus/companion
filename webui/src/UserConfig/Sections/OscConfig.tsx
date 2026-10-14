import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { ConfigNumberField, ConfigSwitchField } from '../Components/ConfigFieldRows.js'
import { PORT_MAX, PORT_MIN } from '../Components/PortRange.js'

export const OscConfig = observer(function OscConfig(props: UserConfigProps) {
	return (
		<>
			<ConfigNumberField
				userConfig={props}
				label="Listen Port"
				field="osc_listen_port"
				min={PORT_MIN}
				max={PORT_MAX}
				help={null}
			/>
			<ConfigSwitchField
				userConfig={props}
				label="Deprecated OSC API"
				field="osc_legacy_api_enabled"
				help="This portion of the API will be removed in a future release."
			/>
		</>
	)
})
