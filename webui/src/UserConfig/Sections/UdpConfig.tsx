import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigPortNumberRow } from '../Components/UserConfigPortNumberRow.js'

export const UdpConfig = observer(function UdpConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="UDP" />
			<UserConfigSwitchRow userConfig={props} label="UDP Listener" field="udp_enabled" />

			{props.config.udp_enabled && (
				<>
					<UserConfigPortNumberRow userConfig={props} label="UDP Listen Port" field="udp_listen_port" />

					<UserConfigSwitchRow
						userConfig={props}
						label={
							<>
								Deprecated UDP API
								<br />
								<em>(This portion of the API will be removed in a future release)</em>
							</>
						}
						field="udp_legacy_api_enabled"
					/>
				</>
			)}
		</>
	)
})
