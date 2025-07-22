import React, { useCallback } from 'react'
import { CFormSwitch } from '@coreui/react'
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
import { validateInputValue } from '~/Helpers/validateInputValue'

interface ConnectionEditFieldProps {
	setValue: (value: any) => void
	definition: ConnectionInputField
	value: any
	connectionId: string
}

export function ConnectionEditField({
	setValue,
	definition,
	value,
	connectionId,
}: ConnectionEditFieldProps): React.JSX.Element {
	const checkValid = useCallback((value: any) => validateInputValue(definition, value) === undefined, [definition])

	const fieldType = definition.type
	switch (definition.type) {
		case 'static-text': {
			return <StaticTextFieldText {...definition} allowImages />
		}
		case 'textinput':
			return <TextInputField value={value} setValue={setValue} checkValid={checkValid} />
		case 'number':
			return (
				<NumberInputField
					min={definition.min}
					max={definition.max}
					step={definition.step}
					range={definition.range}
					value={value}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
		case 'checkbox':
			return (
				<div style={{ marginRight: 40, marginTop: 2 }}>
					<CFormSwitch
						color="success"
						checked={value}
						size="xl"
						onChange={() => {
							setValue(!value)
						}}
					/>
				</div>
			)
		case 'dropdown':
			return (
				<DropdownInputField
					choices={definition.choices}
					allowCustom={definition.allowCustom}
					minChoicesForSearch={definition.minChoicesForSearch}
					regex={definition.regex}
					value={value}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
		case 'multidropdown':
			return (
				<MultiDropdownInputField
					choices={definition.choices}
					allowCustom={definition.allowCustom}
					minSelection={definition.minSelection}
					minChoicesForSearch={definition.minChoicesForSearch}
					maxSelection={definition.maxSelection}
					regex={definition.regex}
					value={value}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
		case 'colorpicker': {
			return (
				<ColorInputField
					value={value}
					setValue={setValue}
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
					value={value}
					setValue={setValue}
					connectionId={connectionId}
					queryId={definition.id}
				/>
			)
		default:
			return <p>Unknown field "{fieldType}"</p>
	}
}
