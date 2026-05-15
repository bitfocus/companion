import { observer } from 'mobx-react-lite'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { ResetButton, type UserConfigProps } from './Common.js'

interface UserConfigSwitchValueRowProps<TKey extends keyof UserConfigModel> {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: TKey
	activeValue: UserConfigModel[TKey]
	inactiveValue: UserConfigModel[TKey]
	title?: string
}
export const UserConfigSwitchValueRow = observer(function UserConfigSwitchValueRow<TKey extends keyof UserConfigModel>({
	userConfig,
	label,
	field,
	activeValue,
	inactiveValue,
	title,
}: UserConfigSwitchValueRowProps<TKey>) {
	return (
		<tr title={title}>
			<td style={{ width: '100%' }}>{label}</td>
			<td>
				<SwitchInputField
					value={userConfig.config[field] === activeValue}
					setValue={(value) => userConfig.setValue(field, value ? activeValue : inactiveValue)}
				/>
			</td>
			<td className="pe-3">
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
