import { CCol, CFormLabel, CFormSwitch, CInputGroupText } from '@coreui/react'
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
import {
	CompanionFieldVariablesSupport,
	type ExpressionOrValue,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import classNames from 'classnames'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { StaticTextFieldText } from './StaticTextField.js'
import type { LocalVariablesStore } from './LocalVariablesStore.js'
import { observer } from 'mobx-react-lite'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { ExpressionInputField } from '~/Components/ExpressionInputField.js'
import { FieldOrExpression } from '~/Components/FieldOrExpression.js'
import type { JsonValue } from 'type-fest'

interface OptionsInputFieldProps {
	allowInternalFields: boolean
	isLocatedInGrid: boolean
	entityType: EntityModelType | null
	option: SomeCompanionInputField
	value: ExpressionOrValue<JsonValue | undefined> | undefined
	setValue: (key: string, value: ExpressionOrValue<JsonValue | undefined>) => void
	visibility: boolean
	readonly?: boolean
	localVariablesStore: LocalVariablesStore | null
	fieldSupportsExpression: boolean
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
	value: rawValue,
	setValue,
	visibility,
	readonly,
	localVariablesStore,
	fieldSupportsExpression,
}: Readonly<OptionsInputFieldProps>): React.JSX.Element {
	let features = getInputFeatures(option)

	const isExpression = !!(option.type === 'textinput' && option.isExpression)

	const setControlValue = useCallback(
		(val: JsonValue) =>
			setValue(option.id, {
				isExpression: isExpression,
				value: val as any,
			} satisfies ExpressionOrValue<JsonValue>),
		[option.id, setValue, isExpression]
	)

	let control = (
		<OptionsInputControl
			allowInternalFields={allowInternalFields}
			isLocatedInGrid={isLocatedInGrid}
			entityType={entityType}
			option={option}
			value={rawValue?.value}
			setValue={setControlValue}
			readonly={readonly}
			localVariablesStore={localVariablesStore}
			features={features}
		/>
	)

	let description = option.description

	if (fieldSupportsExpression) {
		const rawExpressionValue = rawValue || { isExpression: false, value: undefined }

		control = (
			<FieldOrExpression
				localVariablesStore={localVariablesStore}
				value={rawExpressionValue}
				setValue={(val) => setValue(option.id, val)}
				disabled={!!readonly}
				entityType={entityType}
				isLocatedInGrid={isLocatedInGrid}
			>
				{control}
			</FieldOrExpression>
		)

		// Update the features in the label when toggling the mode
		if (rawExpressionValue?.isExpression) {
			if (!features) features = {}
			features.local = true
			features.variables = true

			if (option.expressionDescription !== undefined) {
				description = option.expressionDescription
			}
		}
	}

	return (
		<>
			<CFormLabel
				htmlFor="colFormConnection"
				className={classNames('col-sm-4 col-form-label col-form-label-sm', { displayNone: !visibility })}
			>
				<OptionLabel option={option} features={features} />
			</CFormLabel>
			<CCol sm={8} className={classNames({ displayNone: !visibility })}>
				{control}
				{description && <div className="form-text">{description}</div>}
			</CCol>
		</>
	)
})

interface OptionsInputControlProps {
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
	const checkValid = useCallback(
		(value: JsonValue | undefined) => validateInputValue(option, value) === undefined,
		[option]
	)

	if (!option) return <p>Bad option</p>

	switch (option.type) {
		case 'textinput': {
			if (option.isExpression) {
				const localVariables = localVariablesStore?.getOptions(entityType, true, isLocatedInGrid)

				return (
					<ExpressionInputField
						value={value as any}
						localVariables={localVariables}
						disabled={readonly}
						setValue={setValue}
					/>
				)
			} else {
				const localVariables = features?.local
					? localVariablesStore?.getOptions(
							entityType,
							option.useVariables === CompanionFieldVariablesSupport.InternalParser,
							isLocatedInGrid
						)
					: undefined

				return (
					<TextInputField
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
		}
		case 'dropdown': {
			return (
				<DropdownInputField
					value={value as any}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minChoicesForSearch={option.minChoicesForSearch}
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
					value={value as any}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minSelection={option.minSelection}
					minChoicesForSearch={option.minChoicesForSearch}
					maxSelection={option.maxSelection}
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
					<CFormSwitch
						color="success"
						checked={!!value}
						size="xl"
						onChange={(e) => setValue(e.currentTarget.checked)}
						disabled={readonly}
					/>
				)
			} else {
				return <CheckboxInputField value={value as any} disabled={readonly} setValue={setValue} />
			}
		}
		case 'colorpicker': {
			return (
				<ColorInputField
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
			return <StaticTextFieldText {...option} />
		}
		case 'custom-variable': {
			if (entityType === EntityModelType.Action) {
				return (
					<InternalCustomVariableDropdown disabled={!!readonly} value={value} setValue={setValue} includeNone={true} />
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
				const internalControl =
					InternalModuleField(option, isLocatedInGrid, localVariablesStore, !!readonly, value, setValue) ?? undefined
				if (internalControl) return internalControl
			}
			// Use default below
			break
	}

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
			local:
				option.useVariables === CompanionFieldVariablesSupport.InternalParser ||
				option.useVariables === CompanionFieldVariablesSupport.LocalVariables,
		}
	}
	return undefined
}
