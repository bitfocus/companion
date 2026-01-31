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
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { StaticTextFieldText } from '~/Controls/StaticTextField.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { JsonValue } from 'type-fest'

interface InstanceEditFieldProps {
	setValue: (value: JsonValue | undefined) => void
	definition: SomeCompanionInputField
	value: JsonValue | undefined
	moduleType: ModuleInstanceType
	instanceId: string
}

export function InstanceEditField({
	setValue,
	definition,
	value,
	moduleType,
	instanceId,
}: InstanceEditFieldProps): React.JSX.Element {
	const checkValid = useCallback(
		(value: JsonValue | undefined) => validateInputValue(definition, value) === undefined,
		[definition]
	)

	const fieldType = definition.type
	switch (definition.type) {
		case 'static-text': {
			return <StaticTextFieldText {...definition} allowImages />
		}
		case 'textinput':
			return <TextInputField value={value as any} setValue={setValue} checkValid={checkValid} />
		case 'number':
			return (
				<NumberInputField
					min={definition.min}
					max={definition.max}
					step={definition.step}
					range={definition.range}
					value={value as any}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
		case 'checkbox':
			return (
				<div style={{ marginRight: 40, marginTop: 2 }}>
					<CFormSwitch
						color="success"
						checked={value as any}
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
					value={value as any}
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
					value={value as any}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
		case 'colorpicker': {
			return (
				<ColorInputField
					value={value as any}
					setValue={setValue}
					enableAlpha={definition.enableAlpha ?? false}
					returnType={definition.returnType ?? 'number'}
					presetColors={definition.presetColors}
				/>
			)
		}
		case 'bonjour-device':
			return moduleType === ModuleInstanceType.Connection ? (
				<BonjourDeviceInputField
					value={value as any}
					setValue={setValue}
					connectionId={instanceId}
					queryId={definition.id}
				/>
			) : (
				<p>Bonjour field not supported</p>
			)
		default:
			return <p>Unknown field "{fieldType}"</p>
	}
}
