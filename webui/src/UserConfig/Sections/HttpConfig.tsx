import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import type { UserConfigProps } from '../Components/Common.js'

export const HttpConfig = observer(function HttpConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="HTTP" />

			<UserConfigSwitchRow userConfig={props} label="HTTP API" field="http_api_enabled" />

			<UserConfigSwitchRow
				userConfig={props}
				label={
					<>
						Deprecated HTTP API
						<br />
						<em>(This portion of the API will be removed in a future release)</em>
					</>
				}
				field="http_legacy_api_enabled"
			/>
		</>
	)
})
