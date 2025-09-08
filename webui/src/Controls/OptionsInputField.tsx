import { CCol, CFormLabel, CInputGroupText } from '@coreui/react'
import React, { useCallback } from 'react'
import {
	CheckboxInputField,
	ColorInputField,
	DropdownInputField,
	MultiDropdownInputField,
	NumberInputField,
	TextInputField,
} from '~/Components/index.js'
import { InternalCustomVariableDropdown, InternalModuleField } from './InternalModuleField.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faGlobe, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import classNames from 'classnames'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { StaticTextFieldText } from './StaticTextField.js'
import { LocalVariablesStore } from './LocalVariablesStore.js'
import { observer } from 'mobx-react-lite'
import { validateInputValue } from '~/Helpers/validateInputValue.js'
import { InlineHelp } from '~/Components/InlineHelp.js'

interface OptionsInputFieldProps {
	allowInternalFields: boolean
	isLocatedInGrid: boolean
	entityType: EntityModelType | null
	option: SomeCompanionInputField
	value: any
	setValue: (key: string, value: any) => void
	visibility: boolean
	readonly?: boolean
	localVariablesStore: LocalVariablesStore | null
}

function OptionLabel({ option, features }: { option: SomeCompanionInputField; features?: InputFeatureIconsProps }) {
	return (
		<>
			{option.label}
			<InputFeatureIcons {...features} />
			{option.tooltip && (
				<InlineHelp help={option.tooltip}>
					<FontAwesomeIcon icon={faQuestionCircle} />
				</InlineHelp>
			)}
		</>
	)
}

export const OptionsInputField = observer(function OptionsInputField({
	allowInternalFields,
	isLocatedInGrid,
	entityType,
	option,
	value,
	setValue,
	visibility,
	readonly,
	localVariablesStore,
}: Readonly<OptionsInputFieldProps>): React.JSX.Element {
	const features = getInputFeatures(option)

	return (
		<>
			<CFormLabel
				htmlFor="colFormConnection"
				className={classNames('col-sm-4 col-form-label col-form-label-sm', { displayNone: !visibility })}
			>
				<OptionLabel option={option} features={features} />
			</CFormLabel>
			<CCol sm={8} className={classNames({ displayNone: !visibility })}>
				<OptionsInputControl
					allowInternalFields={allowInternalFields}
					isLocatedInGrid={isLocatedInGrid}
					entityType={entityType}
					option={option}
					value={value}
					setValue={setValue}
					readonly={readonly}
					localVariablesStore={localVariablesStore}
					features={features}
				/>
				{option.description && <div className="form-text">{option.description}</div>}
			</CCol>
		</>
	)
})

interface OptionsInputControlProps {
	allowInternalFields: boolean
	isLocatedInGrid: boolean
	entityType: EntityModelType | null
	option: SomeCompanionInputField
	value: any
	setValue: (key: string, value: any) => void
	readonly?: boolean
	localVariablesStore: LocalVariablesStore | null
	features?: InputFeatureIconsProps
}

export const OptionsInputControl = observer(function OptionsInputControl({
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
	const checkValid = useCallback((value: any) => validateInputValue(option, value) === undefined, [option])
	const setValue2 = useCallback((val: any) => setValue(option.id, val), [option.id, setValue])

	if (!option) {
		return <p>Bad option</p>
	}

	switch (option.type) {
		case 'textinput': {
			const localVariables = features?.local
				? localVariablesStore?.getOptions(entityType, allowInternalFields, isLocatedInGrid)
				: undefined

			return (
				<TextInputField
					value={value}
					placeholder={option.placeholder}
					useVariables={features?.variables ?? false}
					localVariables={localVariables}
					isExpression={option.isExpression}
					disabled={readonly}
					setValue={setValue2}
					checkValid={checkValid}
					multiline={option.multiline}
				/>
			)
		}
		case 'dropdown': {
			return (
				<DropdownInputField
					value={value}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minChoicesForSearch={option.minChoicesForSearch}
					regex={option.regex}
					disabled={readonly}
					setValue={setValue2}
					checkValid={checkValid}
				/>
			)
		}
		case 'multidropdown': {
			return (
				<MultiDropdownInputField
					value={value}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minSelection={option.minSelection}
					minChoicesForSearch={option.minChoicesForSearch}
					maxSelection={option.maxSelection}
					regex={option.regex}
					disabled={readonly}
					setValue={setValue2}
					checkValid={checkValid}
				/>
			)
		}
		case 'checkbox': {
			return <CheckboxInputField value={value} disabled={readonly} setValue={setValue2} />
		}
		case 'colorpicker': {
			return (
				<ColorInputField
					value={value}
					disabled={readonly}
					setValue={setValue2}
					enableAlpha={option.enableAlpha ?? false}
					returnType={option.returnType ?? 'number'}
					presetColors={option.presetColors}
				/>
			)
		}
		case 'number': {
			return (
				<NumberInputField
					value={value}
					min={option.min}
					max={option.max}
					step={option.step}
					range={option.range}
					disabled={readonly}
					setValue={setValue2}
					checkValid={checkValid}
					showMinAsNegativeInfinity={option.showMinAsNegativeInfinity}
					showMaxAsPositiveInfinity={option.showMaxAsPositiveInfinity}
				/>
			)
		}
		case 'static-text': {
			return <StaticTextFieldText {...option} />
		}
		case 'custom-variable': {
			if (entityType === EntityModelType.Action) {
				return (
					<InternalCustomVariableDropdown disabled={!!readonly} value={value} setValue={setValue2} includeNone={true} />
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
					option as any,
					isLocatedInGrid,
					localVariablesStore,
					!!readonly,
					value,
					setValue2
				)
				if (internalControl) {
					return internalControl
				}
			}
			break
	}

	// Fallback for unknown types
	return <CInputGroupText>Unknown type "{option.type}"</CInputGroupText>
})

export interface InputFeatureIconsProps {
	variables?: boolean
	local?: boolean
}

export function InputFeatureIcons(props: InputFeatureIconsProps): JSX.Element | null {
	const featureIcons: JSX.Element[] = []
	if (props.variables)
		featureIcons.push(<FontAwesomeIcon key="variables" icon={faDollarSign} title={'Supports global variables'} />)
	if (props.local) featureIcons.push(<FontAwesomeIcon key="local" icon={faGlobe} title={'Supports local variables'} />)

	return featureIcons.length ? <span className="feature-icons">{featureIcons}</span> : null
}

// eslint-disable-next-line react-refresh/only-export-components
export function getInputFeatures(option: SomeCompanionInputField): InputFeatureIconsProps | undefined {
	if (option.type === 'textinput') {
		return {
			variables: !!option.useVariables,
			local: typeof option.useVariables === 'object' && !!option.useVariables?.local,
		}
	}
	return undefined
}
