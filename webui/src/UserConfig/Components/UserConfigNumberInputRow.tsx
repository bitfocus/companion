import React from 'react'
import { ResetButton, type UserConfigProps } from './Common.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { observer } from 'mobx-react-lite'

interface UserConfigNumberInputRowProps {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: keyof UserConfigModel
	min?: number
	max?: number
	step?: number
}
export const UserConfigNumberInputRow = observer(function UserConfigNumberInputRow({
	userConfig,
	label,
	field,
	min,
	max,
	step,
}: UserConfigNumberInputRowProps) {
	return (
		<tr>
			<td>{label}</td>
			<td>
				<NumberInputField
					value={Number(userConfig.config[field])}
					min={min}
					max={max}
					step={step ?? 1}
					setValue={(rawValue) => {
						let value = Math.floor(Number(rawValue))
						if (isNaN(value)) return

						if (max !== undefined) value = Math.min(value, max)
						if (min !== undefined) value = Math.max(value, min)

						userConfig.setValue(field, value)
					}}
				/>
			</td>
			<td>
				<ResetButton userConfig={userConfig} field={field} />
			</td>
		</tr>
	)
})
