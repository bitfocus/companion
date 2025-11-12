import React from 'react'
import { CAlert } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'
import { UserConfigNumberInputRow } from '../Components/UserConfigNumberInputRow.js'

export const AdminPasswordConfig = observer(function AdminPasswordConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Admin UI Password" />

			<tr>
				<td colSpan={3}>
					<CAlert color="danger">
						This does not make an installation secure!
						<br /> This is intended to keep normal users from stumbling upon the settings and changing things. It will
						not keep out someone determined to bypass it.
					</CAlert>
				</td>
			</tr>

			<UserConfigSwitchRow userConfig={props} label="Enable Locking" field="admin_lockout" />

			{props.config.admin_lockout && (
				<>
					<UserConfigNumberInputRow
						userConfig={props}
						label="Session Timeout (minutes, 0 for no timeout)"
						field="admin_timeout"
						min={0}
						max={24 * 60}
					/>

					<UserConfigTextInputRow userConfig={props} label="Password" field="admin_password" />
				</>
			)}
		</>
	)
})
