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
				<div className="float-right">
					<SwitchInputField
						value={invertIfNeeded(!!userConfig.config[field])}
						setValue={(val) => userConfig.setValue(field, invertIfNeeded(val))}
					/>
				</div>
			</td>
			<td className="pe-3">
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
