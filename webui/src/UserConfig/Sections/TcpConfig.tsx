import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigPortNumberRow } from '../Components/UserConfigPortNumberRow.js'

export const TcpConfig = observer(function TcpConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="TCP" />
			<UserConfigSwitchRow userConfig={props} label="TCP Listener" field="tcp_enabled" />

			{props.config.tcp_enabled && (
				<>
					<UserConfigPortNumberRow userConfig={props} label="TCP Listen Port" field="tcp_listen_port" />

					<UserConfigSwitchRow
						userConfig={props}
						label={
							<>
								Deprecated TCP API
								<br />
								<em>(This portion of the API will be removed in a future release)</em>
							</>
						}
						field="tcp_legacy_api_enabled"
					/>
				</>
			)}
		</>
	)
})
