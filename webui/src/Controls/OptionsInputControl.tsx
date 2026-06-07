import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { JsonValue } from 'type-fest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { CompanionFieldVariablesSupport, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { checkInputValueIsGood } from '@companion-app/shared/ValidateInputValue.js'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { ColorInputField } from '~/Components/ColorInputField.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { ExpressionInputField } from '~/Components/ExpressionInputField.js'
import { InputGroupText } from '~/Components/Form.js'
import { MultiDropdownInputField } from '~/Components/MultiDropdownInputField.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { TextInputField } from '~/Components/TextInputField.js'
import type { InputFeatureIconsProps } from './InputFeatures.js'
import { InternalCustomVariableDropdown, InternalModuleField } from './InternalModuleField.js'
import type { LocalVariablesStore } from './LocalVariablesStore.js'
import { StaticTextFieldText } from './StaticTextField.js'

export interface OptionsInputControlProps {
	inputId: string | undefined
	allowInternalFields: boolean
	isLocatedInGrid: boolean
	entityType: EntityModelType | null
	option: SomeCompanionInputField
	value: JsonValue | undefined
	setValue: (value: any) => void
	readonly?: boolean
	localVariablesStore: LocalVariablesStore | null
	features?: InputFeatureIconsProps
}

export const OptionsInputControl = observer(function OptionsInputControl({
	inputId,
	allowInternalFields,
	isLocatedInGrid,
	entityType,
	option,
	value,
	setValue,
	readonly,
	localVariablesStore,
	features,
}: Readonly<OptionsInputControlProps>): React.JSX.Element {
	const checkValid = useCallback((value: JsonValue | undefined) => checkInputValueIsGood(option, value), [option])

	if (!option) return <p>Bad option</p>

	switch (option.type) {
		case 'textinput': {
			const localVariables = features?.local
				? localVariablesStore?.getOptions(
						entityType,
						option.useVariables === CompanionFieldVariablesSupport.InternalParser,
						isLocatedInGrid
					)
				: undefined

			return (
				<TextInputField
					id={inputId}
					value={value as any}
					placeholder={option.placeholder}
					useVariables={features?.variables ?? false}
					localVariables={localVariables}
					disabled={readonly}
					setValue={setValue}
					checkValid={checkValid}
					multiline={option.multiline}
				/>
			)
		}
		case 'expression': {
			const localVariables = localVariablesStore?.getOptions(entityType, true, isLocatedInGrid)

			return (
				<ExpressionInputField
					id={inputId}
					value={value as any}
					localVariables={localVariables}
					disabled={readonly}
					setValue={setValue}
				/>
			)
		}
		case 'dropdown': {
			return (
				<DropdownInputField
					htmlName={inputId}
					value={value as any}
					choices={option.choices}
					allowCustom={option.allowCustom}
					regex={option.regex}
					disabled={readonly}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
		}
		case 'multidropdown': {
			return (
				<MultiDropdownInputField
					htmlName={inputId}
					value={value as any}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minSelection={option.minSelection}
					maxSelection={option.maxSelection}
					sortSelection={option.sortSelection}
					regex={option.regex}
					disabled={readonly}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
		}
		case 'checkbox': {
			if (option.displayToggle) {
				return (
					<SwitchInputField
						id={inputId}
						value={!!value}
						setValue={setValue}
						tooltip={option.tooltip}
						disabled={readonly}
					/>
				)
			} else {
				return <CheckboxInputField id={inputId} value={value as any} disabled={readonly} setValue={setValue} />
			}
		}
		case 'colorpicker': {
			return (
				<ColorInputField
					id={inputId}
					value={value as any}
					disabled={readonly}
					setValue={setValue}
					enableAlpha={option.enableAlpha ?? false}
					returnType={option.returnType ?? 'number'}
					presetColors={option.presetColors}
				/>
			)
		}
		case 'number': {
			return (
				<NumberInputField
					id={inputId}
					value={value as any}
					min={option.min}
					max={option.max}
					step={option.step}
					range={option.range}
					disabled={readonly}
					setValue={setValue}
					checkValid={checkValid}
					showMinAsNegativeInfinity={option.showMinAsNegativeInfinity}
					showMaxAsPositiveInfinity={option.showMaxAsPositiveInfinity}
				/>
			)
		}
		case 'static-text': {
			return <StaticTextFieldText {...option} id={inputId} />
		}
		case 'custom-variable': {
			if (entityType === EntityModelType.Action) {
				return (
					<InternalCustomVariableDropdown
						id={inputId}
						disabled={!!readonly}
						value={value}
						setValue={setValue}
						includeNone={true}
					/>
				)
			}
			break
		}
		case 'bonjour-device':
		case 'secret-text':
			// Not supported here
			break
		default:
			// The 'internal module' is allowed to use some special input fields, to minimise when it reacts to changes elsewhere in the system
			if (allowInternalFields) {
				const internalControl = InternalModuleField(
					inputId,
					option,
					isLocatedInGrid,
					localVariablesStore,
					!!readonly,
					value,
					setValue
				)
				if (internalControl) return internalControl
			}
			// Use default below
			break
	}

	return <InputGroupText>Unknown type "{option.type}"</InputGroupText>
})
