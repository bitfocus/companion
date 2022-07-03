import { CFormGroup, CInputGroupText, CLabel } from '@coreui/react'
import React, { useCallback } from 'react'
import {
	CheckboxInputField,
	ColorInputField,
	DropdownInputField,
	NumberInputField,
	TextInputField,
	TextWithVariablesInputField,
} from '../../Components'
import { InternalInstanceField } from './InternalInstanceFields'

export function ActionTableRowOption({ instanceId, isOnBank, actionId, option, value, setValue, visibility }) {
	const setValue2 = useCallback((val) => setValue(actionId, option.id, val), [actionId, option.id, setValue])

	if (!option) {
		return <p>Bad option</p>
	}

	let control = undefined
	switch (option.type) {
		case 'textinput': {
			control = <TextInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'textwithvariables': {
			control = <TextWithVariablesInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'dropdown': {
			control = <DropdownInputField value={value} definition={option} multiple={false} setValue={setValue2} />
			break
		}
		case 'multidropdown': {
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
		case 'static-text': {
			// Just the label is wanted
			control = ''
			break
		}
		default:
			// The 'internal instance' is allowed to use some special input fields, to minimise when it reacts to changes elsewhere in the system
			if (instanceId === 'internal') {
				control = InternalInstanceField(option, isOnBank, value, setValue2)
			}
			// Use default below
			break
	}

	if (control === undefined) {
		control = <CInputGroupText>Unknown type "{option.type}"</CInputGroupText>
	}

	return (
		<CFormGroup style={{ display: visibility === false ? 'none' : null }}>
			<CLabel>{option.label}</CLabel>
			{control}
		</CFormGroup>
	)
}
