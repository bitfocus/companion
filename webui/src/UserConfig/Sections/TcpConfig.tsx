import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { ConfigNumberField, ConfigSwitchField } from '../Components/ConfigFieldRows.js'
import { PORT_MAX, PORT_MIN } from '../Components/PortRange.js'

export const TcpConfig = observer(function TcpConfig(props: UserConfigProps) {
	return (
		<>
			<ConfigNumberField
				userConfig={props}
				label="Listen Port"
				field="tcp_listen_port"
				min={PORT_MIN}
				max={PORT_MAX}
				help={null}
			/>
			<ConfigSwitchField
				userConfig={props}
				label="Deprecated TCP API"
				field="tcp_legacy_api_enabled"
				help="This portion of the API will be removed in a future release."
			/>
		</>
	)
})
