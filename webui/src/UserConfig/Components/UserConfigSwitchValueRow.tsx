import { CFormSwitch } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
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
				<CFormSwitch
					className="float-right"
					color="success"
					checked={userConfig.config[field] === activeValue}
					size="xl"
					onChange={(e) => userConfig.setValue(field, e.currentTarget.checked ? activeValue : inactiveValue)}
				/>
			</td>
			<td className="pe-3">
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
