import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigProps } from '../Components/Common.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'
import { UserConfigNumberInputRow } from '../Components/UserConfigNumberInputRow.js'

export const PinLockoutConfig = observer(function PinLockoutConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="PIN Lockout" />

			<UserConfigSwitchRow userConfig={props} label="Enable Pin Codes" field="pin_enable" />

			{props.config.pin_enable && (
				<>
					<UserConfigSwitchRow userConfig={props} label="Link Lockouts" field="link_lockouts" />

					<UserConfigTextInputRow userConfig={props} label="Pin Code" field="pin" />

					<UserConfigNumberInputRow
						userConfig={props}
						label="Pin Timeout (seconds, 0 to turn off)"
						field="pin_timeout"
						min={0}
					/>
				</>
			)}
		</>
	)
})
