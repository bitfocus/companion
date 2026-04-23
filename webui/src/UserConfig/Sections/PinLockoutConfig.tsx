import { observer } from 'mobx-react-lite'
import { ContextHelpButton } from '~/Layout/PanelIcons.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigNumberInputRow } from '../Components/UserConfigNumberInputRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'

export const PinLockoutConfig = observer(function PinLockoutConfig(props: UserConfigProps) {
	const indentLabel = (label: string) => {
		return <span style={{ display: 'inline-block', paddingLeft: '1em' }}>{label}</span>
	}
	// note: hold on to the heading row in case we want to make a "security" page.
	return (
		<>
			{/* <UserConfigHeadingRow
				label="PIN Lockout"
				helpMessage="Enable this feature to lock input surfaces when idle for a specified time."
				helpAction="/user-guide/config/settings#pin-lockout"
			/>
 */}
			<UserConfigSwitchRow
				userConfig={props}
				label={
					<>
						<span>Enable PIN Lockout </span>
						<ContextHelpButton action="/user-guide/config/settings#pin-lockout">
							Enable this feature to lock input surfaces when idle for a specified time.
						</ContextHelpButton>
					</>
				}
				field="pin_enable"
			/>

			{props.config.pin_enable && (
				<>
					<UserConfigSwitchRow
						userConfig={props}
						label={indentLabel('Link Lockouts')}
						field="link_lockouts"
						title="Lock out all surfaces when one is locked out."
					/>

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
