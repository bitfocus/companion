import { CFormGroup, CInputGroupText, CLabel } from '@coreui/react'
import React, { useCallback } from 'react'
import {
	CheckboxInputField,
	ColorInputField,
	DropdownInputField,
	NumberInputField,
	TextInputField,
} from '../Components'
import { InternalCustomVariableDropdown, InternalInstanceField } from './InternalInstanceFields'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

export function OptionsInputField({
	instanceId,
	isOnControl,
	isAction,
	actionId,
	option,
	value,
	setValue,
	visibility,
	readonly,
}) {
	const setValue2 = useCallback((val) => setValue(actionId, option.id, val), [actionId, option.id, setValue])

	if (!option) {
		return <p>Bad option</p>
	}

	let control = undefined
	switch (option.type) {
		case 'textinput': {
			control = (
				<TextInputField
					value={value}
					regex={option.regex}
					required={option.required}
					placeholder={option.placeholder}
					useVariables={option.useVariables}
					disabled={readonly}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'dropdown': {
			control = (
				<DropdownInputField
					value={value}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minChoicesForSearch={option.minChoicesForSearch}
					regex={option.regex}
					disabled={readonly}
					multiple={false}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'multidropdown': {
			control = (
				<DropdownInputField
					value={value}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minSelection={option.minSelection}
					minChoicesForSearch={option.minChoicesForSearch}
					maxSelection={option.maxSelection}
					regex={option.regex}
					disabled={readonly}
					multiple={true}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'checkbox': {
			control = (
				<p>
					<CheckboxInputField value={value} disabled={readonly} setValue={setValue2} />
					&nbsp;
				</p>
			)
			break
		}
		case 'colorpicker': {
			control = (
				<ColorInputField
					value={value}
					disabled={readonly}
					setValue={setValue2}
					enableAlpha={option.enableAlpha ?? false}
					returnType={option.returnType ?? 'number'}
					presetColors={option.presetColors}
				/>
			)
			break
		}
		case 'number': {
			control = (
				<NumberInputField
					value={value}
					required={option.required}
					min={option.min}
					max={option.max}
					step={option.step}
					range={option.range}
					disabled={readonly}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'static-text': {
			// Just the label is wanted
			control = ''
			break
		}
		case 'custom-variable': {
			if (isAction) {
				control = (
					<InternalCustomVariableDropdown disabled={readonly} value={value} setValue={setValue2} includeNone={true} />
				)
			}
			break
		}
		default:
			// The 'internal instance' is allowed to use some special input fields, to minimise when it reacts to changes elsewhere in the system
			if (instanceId === 'internal') {
				control = InternalInstanceField(option, isOnControl, readonly, value, setValue2)
			}
			// Use default below
			break
	}

	if (control === undefined) {
		control = <CInputGroupText>Unknown type "{option.type}"</CInputGroupText>
	}

	return (
		<CFormGroup style={{ display: visibility === false ? 'none' : null }}>
			<CLabel>
				{option.label}
				{option.tooltip && (
					<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} title={option.tooltip} />
				)}
			</CLabel>
			{control}
		</CFormGroup>
	)
}
