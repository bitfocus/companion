import React from 'react'
import { CFormSwitch } from '@coreui/react'
import { ResetButton, UserConfigProps } from './Common.js'
import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface UserConfigSwitchRowProps {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: keyof UserConfigModel
	requiresRestart?: boolean
}
export const UserConfigSwitchRow = observer(function UserConfigSwitchRow({
	userConfig,
	label,
	field,
	requiresRestart,
}: UserConfigSwitchRowProps) {
	return (
		<tr>
			<td>
				{label}
				{requiresRestart && (
					<>
						<br />
						<em>(Requires Companion restart)</em>
					</>
				)}
			</td>
			<td>
				<CFormSwitch
					className="float-right"
					color="success"
					checked={!!userConfig.config[field]}
					size="xl"
					onChange={(e) => userConfig.setValue(field, e.currentTarget.checked)}
				/>
			</td>
			<td>
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
