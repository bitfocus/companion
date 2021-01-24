import { CFormGroup, CInputGroupText, CLabel } from "@coreui/react"
import React, { useCallback } from "react"
import { CheckboxInputField, ColorInputField, DropdownInputField, NumberInputField, TextInputField } from "../Components"

export function ActionTableRowOption({ actionId, option, value, setValue }) {
	const setValue2 = useCallback((val) => setValue(actionId, option.id, val), [actionId, option.id, setValue])

	if (!option) {
		return <p>Unknown - TODO</p>
	}

	let control = ''
	switch (option.type) {
		case 'textinput': {
			control = <TextInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'dropdown': {
			control = <DropdownInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'multiselect': {
			control = <DropdownInputField value={value} definition={option} multiple={true} setValue={setValue2} />
			break
		}
		case 'checkbox': {
			control = <CheckboxInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'colorpicker': {
			control = <ColorInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'number': {
			control = <NumberInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		default:
			control = <CInputGroupText>Unknown type "{option.type}"</CInputGroupText>
			break
	}

	return (
		<CFormGroup>
			<CLabel>{option.label}</CLabel>
			{ control}
		</CFormGroup>
	)
}