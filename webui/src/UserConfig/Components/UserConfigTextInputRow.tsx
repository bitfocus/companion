import React from 'react'
import { ResetButton, UserConfigProps } from './Common.js'
import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { TextInputField } from '../../Components/TextInputField.js'
import { observer } from 'mobx-react-lite'

interface UserConfigTextInputRowProps {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: keyof UserConfigModel
}
export const UserConfigTextInputRow = observer(function UserConfigTextInputRow({
	userConfig,
	label,
	field,
}: UserConfigTextInputRowProps) {
	return (
		<tr>
			<td>{label}</td>
			<td>
				<TextInputField
					value={String(userConfig.config[field])}
					setValue={(value) => userConfig.setValue(field, value)}
				/>
			</td>
			<td>
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
