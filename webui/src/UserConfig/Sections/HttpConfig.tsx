import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { ConfigSwitchField } from '../Components/ConfigFieldRows.js'

export const HttpConfig = observer(function HttpConfig(props: UserConfigProps) {
	return (
		<ConfigSwitchField
			userConfig={props}
			label="Deprecated HTTP API"
			field="http_legacy_api_enabled"
			help="This portion of the API will be removed in a future release."
		/>
	)
})
