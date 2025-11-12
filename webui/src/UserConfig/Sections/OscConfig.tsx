import React from 'react'
import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigPortNumberRow } from '../Components/UserConfigPortNumberRow.js'

export const OscConfig = observer(function OscConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="OSC" />

			<UserConfigSwitchRow userConfig={props} label="OSC Listener" field="osc_enabled" />

			{props.config.osc_enabled && (
				<>
					<UserConfigPortNumberRow userConfig={props} label="OSC Listen Port" field="osc_listen_port" />

					<UserConfigSwitchRow
						userConfig={props}
						label={
							<>
								Deprecated
								<br />
								<em>(This portion of the API will be removed in a future release)</em>
							</>
						}
						field="osc_legacy_api_enabled"
					/>
				</>
			)}
		</>
	)
})
