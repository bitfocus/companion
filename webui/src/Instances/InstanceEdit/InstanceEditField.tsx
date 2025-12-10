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
import { validateInputValue } from '~/Helpers/validateInputValue'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

interface InstanceEditFieldProps {
	setValue: (value: any) => void
	definition: SomeCompanionInputField
	value: any
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
		}
		case 'bonjour-device':
			return moduleType === ModuleInstanceType.Connection ? (
				<BonjourDeviceInputField value={value} setValue={setValue} connectionId={instanceId} queryId={definition.id} />
			) : (
				<p>Bonjour field not supported</p>
			)
		default:
			return <p>Unknown field "{fieldType}"</p>
	}
}
