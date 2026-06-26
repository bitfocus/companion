import { observer } from 'mobx-react-lite'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { ResetButton, type UserConfigProps } from './Common.js'

interface UserConfigDropdownRowProps {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: keyof UserConfigModel
	choices: DropdownChoice[]
	searchLabelsOnly?: boolean
}
export const UserConfigDropdownRow = observer(function UserConfigDropdownRow({
	userConfig,
	label,
	field,
	choices,
	searchLabelsOnly,
}: UserConfigDropdownRowProps) {
	return (
		<tr>
			<td>{label}</td>
			<td>
				<DropdownInputField
					htmlName={undefined} // Future: set this for better accessibility
					choices={choices}
					value={String(userConfig.config[field] as any)}
					setValue={(value) => userConfig.setValue(field, value)}
					searchLabelsOnly={searchLabelsOnly}
				/>
			</td>
			<td>
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
