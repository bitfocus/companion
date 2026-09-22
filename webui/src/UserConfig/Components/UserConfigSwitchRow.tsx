import { observer } from 'mobx-react-lite'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { ResetButton, type UserConfigProps } from './Common.js'

interface UserConfigSwitchRowProps {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: keyof UserConfigModel
	requiresRestart?: boolean
	inverted?: boolean
	title?: string
}
export const UserConfigSwitchRow = observer(function UserConfigSwitchRow({
	userConfig,
	label,
	field,
	requiresRestart,
	inverted,
	title,
}: UserConfigSwitchRowProps) {
	const invertIfNeeded = (value: boolean) => (inverted ? !value : value)
	return (
		<tr title={title}>
			<td>
				<div>
					<span>{label}</span>
					{requiresRestart && (
						<span className="ms-2 text-xs text-amber-500 italic font-normal">(Requires Companion restart)</span>
					)}
				</div>
			</td>
			<td className="settings-value-end">
				<div className="flex justify-end items-center">
					<SwitchInputField
						id={undefined}
						value={invertIfNeeded(!!userConfig.config[field])}
						setValue={(val) => userConfig.setValue(field, invertIfNeeded(val))}
					/>
				</div>
			</td>
			<td>
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
