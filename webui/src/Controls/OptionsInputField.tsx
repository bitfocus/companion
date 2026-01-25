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
import type { ExpressionOrValue, SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
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
	connectionId: string
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
	connectionId,
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
	const checkValid = useCallback((value: JsonValue) => validateInputValue(option, value) === undefined, [option])
	const setExpressionValue = useCallback(
		(val: string) =>
			setValue(option.id, {
				isExpression: true,
				value: val,
			} satisfies ExpressionOrValue<JsonValue>),
		[option.id, setValue]
	)
	const setBasicValue = useCallback(
		(val: JsonValue) =>
			setValue(option.id, {
				isExpression: false,
				value: val,
			} satisfies ExpressionOrValue<JsonValue>),
		[option.id, setValue]
	)

	const basicValue: JsonValue | undefined = rawValue?.value

	if (!option) {
		return <p>Bad option</p>
	}

	const isInternal = connectionId === 'internal'

	let control: JSX.Element | string | undefined = undefined
	let features: InputFeatureIconsProps | undefined = undefined
	switch (option.type) {
		case 'textinput': {
			features = {
				variables: !!option.useVariables,
				local: typeof option.useVariables === 'object' && !!option.useVariables?.local,
			}

			const localVariables = features.local
				? localVariablesStore?.getOptions(entityType, isInternal, isLocatedInGrid)
				: undefined

			control = option.isExpression ? (
				<ExpressionInputField
					value={basicValue as any}
					localVariables={localVariables}
					disabled={readonly}
					setValue={setExpressionValue}
				/>
			) : (
				<TextInputField
					value={basicValue as any}
					placeholder={option.placeholder}
					useVariables={features.variables}
					localVariables={localVariables}
					disabled={readonly}
					setValue={setBasicValue}
					checkValid={checkValid}
					multiline={option.multiline}
				/>
			)
			break
		}
		case 'dropdown': {
			control = (
				<DropdownInputField
					value={basicValue as any}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minChoicesForSearch={option.minChoicesForSearch}
					regex={option.regex}
					disabled={readonly}
					setValue={setBasicValue}
					checkValid={checkValid}
				/>
			)
			break
		}
		case 'multidropdown': {
			control = (
				<MultiDropdownInputField
					value={basicValue as any}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minSelection={option.minSelection}
					minChoicesForSearch={option.minChoicesForSearch}
					maxSelection={option.maxSelection}
					regex={option.regex}
					disabled={readonly}
					setValue={setBasicValue}
					checkValid={checkValid}
				/>
			)
			break
		}
		case 'checkbox': {
			if (option.displayToggle) {
				control = (
					<CFormSwitch
						color="success"
						checked={!!basicValue}
						size="xl"
						onChange={(e) => setBasicValue(e.currentTarget.checked)}
						disabled={readonly}
					/>
				)
			} else {
				control = <CheckboxInputField value={basicValue as any} disabled={readonly} setValue={setBasicValue} />
			}
			break
		}
		case 'colorpicker': {
			control = (
				<ColorInputField
					value={basicValue as any}
					disabled={readonly}
					setValue={setBasicValue}
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
					value={basicValue as any}
					min={option.min}
					max={option.max}
					step={option.step}
					range={option.range}
					disabled={readonly}
					setValue={setBasicValue}
					checkValid={checkValid}
					showMinAsNegativeInfinity={option.showMinAsNegativeInfinity}
					showMaxAsPositiveInfinity={option.showMaxAsPositiveInfinity}
				/>
			)
			break
		}
		case 'static-text': {
			control = <StaticTextFieldText {...option} />
			break
		}
		case 'custom-variable': {
			if (entityType === EntityModelType.Action) {
				control = (
					<InternalCustomVariableDropdown
						disabled={!!readonly}
						value={basicValue}
						setValue={setBasicValue}
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
			if (isInternal) {
				control =
					InternalModuleField(option, isLocatedInGrid, localVariablesStore, !!readonly, basicValue, setBasicValue) ??
					undefined
			}
			// Use default below
			break
	}

	let description = option.description

	if (control === undefined) {
		control = <CInputGroupText>Unknown type "{option.type}"</CInputGroupText>
	} else if (fieldSupportsExpression) {
		const rawExpressionValue = rawValue || { isExpression: false, value: undefined }

		control = (
			<FieldOrExpression
				localVariablesStore={localVariablesStore}
				value={rawExpressionValue}
				setValue={(val) => setValue(option.id, val)}
				disabled={!!readonly}
				entityType={entityType}
				isInternal={isInternal}
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
