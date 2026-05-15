import { useCallback } from 'react'
import type { JsonValue } from 'type-fest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { checkInputValueIsGood } from '@companion-app/shared/ValidateInputValue.js'
import { BonjourDeviceInputField } from '~/Components/BonjourDeviceInputField.js'
import { ColorInputField } from '~/Components/ColorInputField'
import { DropdownInputField } from '~/Components/DropdownInputField'
import { MultiDropdownInputField } from '~/Components/MultiDropdownInputField'
import { NumberInputField } from '~/Components/NumberInputField'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { TextInputField } from '~/Components/TextInputField'
import { StaticTextFieldText } from '~/Controls/StaticTextField.js'

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
		(value: JsonValue | undefined) => checkInputValueIsGood(definition, value),
		[definition]
	)

	const fieldType = definition.type
	switch (definition.type) {
		case 'static-text': {
			return <StaticTextFieldText {...definition} allowImages />
		}
		case 'textinput':
			return (
				<TextInputField
					value={value as any}
					setValue={setValue}
					checkValid={checkValid}
					multiline={definition.multiline}
					placeholder={definition.placeholder}
				/>
			)
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
					<SwitchInputField value={!!value} setValue={setValue} tooltip={definition.tooltip} />
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
					sortSelection={definition.sortSelection}
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
