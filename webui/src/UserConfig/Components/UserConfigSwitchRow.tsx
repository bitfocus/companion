import React from 'react'
import { CFormSwitch } from '@coreui/react'
import { ResetButton, type UserConfigProps } from './Common.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface UserConfigSwitchRowProps {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: keyof UserConfigModel
	requiresRestart?: boolean
	inverted?: boolean
}
export const UserConfigSwitchRow = observer(function UserConfigSwitchRow({
	userConfig,
	label,
	field,
	requiresRestart,
	inverted,
}: UserConfigSwitchRowProps) {
	const invertIfNeeded = (value: boolean) => (inverted ? !value : value)
	return (
		<tr>
			<td style={{ width: '100%' }}>
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
					checked={invertIfNeeded(!!userConfig.config[field])}
					size="xl"
					onChange={(e) => userConfig.setValue(field, invertIfNeeded(e.currentTarget.checked))}
				/>
			</td>
			<td className="pe-3">
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
