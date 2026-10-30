import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { ConfigNumberField } from '../Components/ConfigFieldRows.js'

export const LinkConfig = observer(function LinkConfig(props: UserConfigProps) {
	return (
		<ConfigNumberField
			userConfig={props}
			label="Listen Port"
			field="link_direct_port"
			min={1024}
			max={65535}
			help="Other installations connect to this port, unless they are told a different one in their address."
		/>
	)
})
