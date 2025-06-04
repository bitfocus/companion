import React, { useCallback } from 'react'
import { CFormSwitch, CFormLabel } from '@coreui/react'
import {
	ColorInputField,
	DropdownInputField,
	MultiDropdownInputField,
	NumberInputField,
	TextInputField,
} from '~/Components/index.js'
import { BonjourDeviceInputField } from '~/Components/BonjourDeviceInputField.js'
import { ConnectionInputField } from '@companion-app/shared/Model/Options.js'
import { StaticTextFieldText } from '~/Controls/StaticTextField.js'

interface ConnectionEditFieldProps {
	label: React.ReactNode
	setValue: (value: any) => void
	setValid: (key: string, valid: boolean) => void
	definition: ConnectionInputField
	value: any
	connectionId: string
}

export function ConnectionEditField({
	label,
	setValue,
	setValid,
	definition,
	value,
	connectionId,
}: ConnectionEditFieldProps) {
	const id = definition.id
	const setValid2 = useCallback((valid: boolean) => setValid(id, valid), [setValid, id])

	const fieldType = definition.type
	switch (definition.type) {
		case 'static-text': {
			const control = <StaticTextFieldText {...definition} allowImages />

			if (!!label) {
				return (
					<>
						<CFormLabel>{label}</CFormLabel>
						{control}
					</>
				)
			}

			return control
		}
		case 'textinput':
			return (
				<TextInputField
					label={label}
					value={value}
					regex={definition.regex}
					required={definition.required}
					setValue={setValue}
					setValid={setValid2}
				/>
			)
		case 'number':
			return (
				<NumberInputField
					label={label}
					required={definition.required}
					min={definition.min}
					max={definition.max}
					step={definition.step}
					range={definition.range}
					value={value}
					setValue={setValue}
					setValid={setValid2}
				/>
			)
		case 'checkbox':
			return (
				<div style={{ marginRight: 40, marginTop: 2 }}>
					{label ? <CFormLabel>{label}</CFormLabel> : ''}
					<CFormSwitch
						color="success"
						checked={value}
						size="xl"
						title={definition.tooltip} // nocommit: this needs fixing
						onChange={() => {
							setValue(!value)
							//setValid2(true)
						}}
					/>
				</div>
			)
		case 'dropdown':
			return (
				<DropdownInputField
					label={label}
					choices={definition.choices}
					allowCustom={definition.allowCustom}
					minChoicesForSearch={definition.minChoicesForSearch}
					regex={definition.regex}
					value={value}
					setValue={setValue}
					setValid={setValid2}
				/>
			)
		case 'multidropdown':
			return (
				<MultiDropdownInputField
					label={label}
					choices={definition.choices}
					allowCustom={definition.allowCustom}
					minSelection={definition.minSelection}
					minChoicesForSearch={definition.minChoicesForSearch}
					maxSelection={definition.maxSelection}
					regex={definition.regex}
					value={value}
					setValue={setValue}
					setValid={setValid2}
				/>
			)
		case 'colorpicker': {
			return (
				<ColorInputField
					label={label}
					value={value}
					setValue={setValue}
					setValid={setValid2}
					enableAlpha={definition.enableAlpha ?? false}
					returnType={definition.returnType ?? 'number'}
					presetColors={definition.presetColors}
				/>
			)
			break
		}
		case 'bonjour-device':
			return (
				<BonjourDeviceInputField
					label={label}
					value={value}
					setValue={setValue}
					connectionId={connectionId}
					queryId={definition.id}
				/>
			)
		case 'secret-text':
			// TODO
			return <p>TEST</p>
		default:
			return <p>Unknown field "{fieldType}"</p>
	}
}
