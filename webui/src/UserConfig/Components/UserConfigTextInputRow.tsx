import { observer } from 'mobx-react-lite'
import type { UserConfigKeyOfType } from '@companion-app/shared/Model/UserConfigModel.js'
import { keyValueChange } from '@companion-app/shared/Util/KeyValue.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { ResetButton, type UserConfigProps } from './Common.js'

interface UserConfigTextInputRowProps {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: UserConfigKeyOfType<string>
	useVariables?: boolean
}
export const UserConfigTextInputRow = observer(function UserConfigTextInputRow({
	userConfig,
	label,
	field,
	useVariables,
}: UserConfigTextInputRowProps) {
	const isReadonly = userConfig.readonlyKeys.has(field)
	return (
		<tr>
			<td>{label}</td>
			<td>
				<TextInputField
					id={undefined} // Future: set this for better accessibility
					value={String(userConfig.config[field] as any)}
					setValue={(value) => userConfig.setValue(keyValueChange(field, value))}
					useVariables={useVariables}
					disabled={isReadonly}
					tooltip={isReadonly ? 'This value is locked by an environment variable' : undefined}
				/>
			</td>
			<td>{!isReadonly && <ResetButton userConfig={userConfig} field={field} />}</td>
		</tr>
	)
})
