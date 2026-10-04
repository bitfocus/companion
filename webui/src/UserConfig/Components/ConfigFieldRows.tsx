import { observer } from 'mobx-react-lite'
import { useId } from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { ResetButton, type UserConfigProps } from './Common.js'

interface ConfigFieldRowProps {
	label: string
	/** The id of the control, so the label can point at it, or `null` when there is no control to label */
	htmlFor: string | null
	/** Explanation shown under the control, or `null` */
	help: React.ReactNode
	children: React.ReactNode
}

/** One labelled row of an edit panel's settings section: the label, then the control and anything beside it. */
export function ConfigFieldRow({ label, htmlFor, help, children }: ConfigFieldRowProps): React.JSX.Element {
	return (
		<div className="edit-field-row">
			<label htmlFor={htmlFor ?? undefined} className="text-xs font-semibold text-body-text">
				{label}
			</label>
			<div className="flex items-center gap-2 min-w-0">{children}</div>
			{help && <div className="edit-field-help text-xs text-muted">{help}</div>}
		</div>
	)
}

interface ConfigSwitchFieldProps {
	userConfig: UserConfigProps
	label: string
	field: keyof UserConfigModel
	help: React.ReactNode
}

export const ConfigSwitchField = observer(function ConfigSwitchField({
	userConfig,
	label,
	field,
	help,
}: ConfigSwitchFieldProps) {
	const id = useId()
	const isLocked = userConfig.readonlyKeys.has(field)

	return (
		<ConfigFieldRow label={label} htmlFor={id} help={help}>
			<SwitchInputField
				id={id}
				value={!!userConfig.config[field]}
				setValue={(value) => userConfig.setValue(field, value)}
				disabled={isLocked}
			/>
			{!isLocked && <ResetButton userConfig={userConfig} field={field} />}
		</ConfigFieldRow>
	)
})

interface ConfigNumberFieldProps {
	userConfig: UserConfigProps
	label: string
	field: keyof UserConfigModel
	min: number
	max: number
	help: React.ReactNode
}

export const ConfigNumberField = observer(function ConfigNumberField({
	userConfig,
	label,
	field,
	min,
	max,
	help,
}: ConfigNumberFieldProps) {
	const id = useId()
	const isLocked = userConfig.readonlyKeys.has(field)

	return (
		<ConfigFieldRow label={label} htmlFor={id} help={help}>
			<div className="grow min-w-0">
				<NumberInputField
					id={id}
					value={Number(userConfig.config[field])}
					min={min}
					max={max}
					step={1}
					disabled={isLocked}
					setValue={(rawValue) => {
						const value = Math.floor(Number(rawValue))
						if (isNaN(value)) return

						userConfig.setValue(field, Math.min(Math.max(value, min), max))
					}}
				/>
			</div>
			{!isLocked && <ResetButton userConfig={userConfig} field={field} />}
		</ConfigFieldRow>
	)
})

interface ConfigTextFieldProps {
	userConfig: UserConfigProps
	label: string
	field: keyof UserConfigModel
	help: React.ReactNode
}

export const ConfigTextField = observer(function ConfigTextField({
	userConfig,
	label,
	field,
	help,
}: ConfigTextFieldProps) {
	const id = useId()
	const isLocked = userConfig.readonlyKeys.has(field)

	return (
		<ConfigFieldRow label={label} htmlFor={id} help={help}>
			<div className="grow min-w-0">
				<TextInputField
					id={id}
					value={String((userConfig.config[field] as any) ?? '')}
					setValue={(value) => userConfig.setValue(field, value)}
					disabled={isLocked}
					tooltip={isLocked ? 'This value is locked by an environment variable' : undefined}
				/>
			</div>
			{!isLocked && <ResetButton userConfig={userConfig} field={field} />}
		</ConfigFieldRow>
	)
})

interface ConfigDropdownFieldProps {
	userConfig: UserConfigProps
	label: string
	field: keyof UserConfigModel
	choices: DropdownChoice[]
	help: React.ReactNode
}

export const ConfigDropdownField = observer(function ConfigDropdownField({
	userConfig,
	label,
	field,
	choices,
	help,
}: ConfigDropdownFieldProps) {
	const id = useId()
	const isLocked = userConfig.readonlyKeys.has(field)

	return (
		<ConfigFieldRow label={label} htmlFor={id} help={help}>
			<div className="grow min-w-0">
				<SimpleDropdownInputField
					id={id}
					value={String((userConfig.config[field] as any) ?? '')}
					setValue={(value) => userConfig.setValue(field, value)}
					choices={choices}
					disabled={isLocked}
				/>
			</div>
			{!isLocked && <ResetButton userConfig={userConfig} field={field} />}
		</ConfigFieldRow>
	)
})

interface ConfigStaticFieldProps {
	label: string
	value: React.ReactNode
	help: React.ReactNode
}

/** A value that is shown for reference but can't be changed */
export function ConfigStaticField({ label, value, help }: ConfigStaticFieldProps): React.JSX.Element {
	return (
		<ConfigFieldRow label={label} htmlFor={null} help={help}>
			<span className="text-sm font-mono tabular-nums">{value}</span>
		</ConfigFieldRow>
	)
}
