import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'
import { UserConfigNumberInputRow } from '../Components/UserConfigNumberInputRow.js'

export const PinLockoutConfig = observer(function PinLockoutConfig(props: UserConfigProps) {
	const indentLabel = (label: string) => {
		return <span style={{ display: 'inline-block', paddingLeft: '1em' }}>{label}</span>
	}
	// note: hold on to the heading row in case we want to make a "security" page.
	return (
		<>
			{/* <UserConfigHeadingRow
				label="PIN Lockout"
				tooltip="Enable this feature to lock input surfaces when idle for a specified time."
			/>
 */}
			<UserConfigSwitchRow
				userConfig={props}
				label="Enable PIN Lockout"
				field="pin_enable"
				title="Enable this feature to lock input surfaces when idle for a specified time."
			/>

			{props.config.pin_enable && (
				<>
					<UserConfigSwitchRow userConfig={props} label={indentLabel('Link Lockouts')} field="link_lockouts" />

					<UserConfigTextInputRow userConfig={props} label={indentLabel('PIN Unlock Code')} field="pin" />

					<UserConfigNumberInputRow
						userConfig={props}
						label={indentLabel('PIN Lockout Timeout (seconds, 0 to turn off)')}
						field="pin_timeout"
						min={0}
					/>
				</>
			)}
		</>
	)
})
