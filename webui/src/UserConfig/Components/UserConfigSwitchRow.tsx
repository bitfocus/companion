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
	/** Why the setting can't be changed here, which disables it and shows it as off */
	disabledReason?: string
}
export const UserConfigSwitchRow = observer(function UserConfigSwitchRow({
	userConfig,
	label,
	field,
	requiresRestart,
	inverted,
	title,
	disabledReason,
}: UserConfigSwitchRowProps) {
	const invertIfNeeded = (value: boolean) => (inverted ? !value : value)
	return (
		<tr title={title}>
			<td className="w-full">
				{label}
				{requiresRestart && (
					<>
						<br />
						<em>(Requires Companion restart)</em>
					</>
				)}
				{!!disabledReason && <div className="text-xs text-muted">{disabledReason}</div>}
			</td>
			<td>
				<div className="float-right">
					<SwitchInputField
						id={undefined} // Future: set this for better accessibility
						value={!disabledReason && invertIfNeeded(!!userConfig.config[field])}
						setValue={(val) => userConfig.setValue(field, invertIfNeeded(val))}
						disabled={!!disabledReason}
					/>
				</div>
			</td>
			<td className="pe-4">
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
