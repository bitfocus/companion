import { faDollarSign, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useId } from 'react'
import type { JsonValue } from 'type-fest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import {
	CompanionFieldVariablesSupport,
	type ExpressionOrValue,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { checkInputValueIsGood } from '@companion-app/shared/ValidateInputValue.js'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { ColorInputField } from '~/Components/ColorInputField.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { ExpressionInputField } from '~/Components/ExpressionInputField.js'
import { ExpressionValuePreview } from '~/Components/ExpressionValuePreview.js'
import { FieldOrExpression } from '~/Components/FieldOrExpression.js'
import { FormLabel, InputGroupText } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { ImagePreviewIcon, ImagePreviewIconFromExpression } from '~/Components/ImagePreviewIcon.js'
import { InlineHelpCustom, InlineHelpIcon } from '~/Components/InlineHelp.js'
import { MultiDropdownInputField } from '~/Components/MultiDropdownInputField.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { InternalCustomVariableDropdown, InternalModuleField } from './InternalModuleField.js'
import type { LocalVariablesStore } from './LocalVariablesStore.js'
import { StaticTextFieldText } from './StaticTextField.js'

const ExpressionModeFeatures: InputFeatureIconsProps = Object.freeze({
	variables: true,
	local: true,
})

interface OptionsInputFieldProps {
	allowInternalFields: boolean
	controlId?: string | null
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

function OptionLabel({
	option,
	features,
	imagePreviewNode,
}: {
	option: SomeCompanionInputField
	features?: InputFeatureIconsProps
	imagePreviewNode?: React.ReactNode
}) {
	return (
		<>
			{option.label}
			<InputFeatureIcons {...features} />
			{option.tooltip && <InlineHelpIcon className="ms-1">{option.tooltip}</InlineHelpIcon>}
			{imagePreviewNode}
		</>
	)
}

export const OptionsInputField = observer(function OptionsInputField({
	allowInternalFields,
	controlId,
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
	const features = getInputFeatures(option)

	const isExpression = option.type === 'expression'
	let isInExpressionMode = isExpression

	const setControlValue = useCallback(
		(val: JsonValue) =>
			setValue(option.id, {
				isExpression: isExpression,
				value: val as any,
			} satisfies ExpressionOrValue<JsonValue>),
		[option.id, setValue, isExpression]
	)

	const inputId = useId()

	let control = (
		<OptionsInputControl
			inputId={inputId}
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

	if (fieldSupportsExpression && option.type !== 'expression') {
		const rawExpressionValue = rawValue || { isExpression: false, value: undefined }

		control = (
			<FieldOrExpression
				inputId={inputId}
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
			isInExpressionMode = true
		}
	}

	const description =
		isInExpressionMode && option.expressionDescription !== undefined ? option.expressionDescription : option.description

	const isImageField = option.type === 'internal:image-file'
	let imagePreviewNode: React.ReactNode = null
	if (isImageField) {
		if (isInExpressionMode) {
			imagePreviewNode = (
				<ImagePreviewIconFromExpression
					expression={stringifyVariableValue(rawValue?.value) ?? ''}
					controlId={controlId ?? null}
				/>
			)
		} else {
			imagePreviewNode = <ImagePreviewIcon value={(rawValue?.value as string | null) ?? null} />
		}
	}

	return (
		<>
			<FormLabel
				htmlFor={inputId}
				className={classNames('col-sm-4 col-form-label col-form-label-sm', { displayNone: !visibility })}
			>
				<OptionLabel
					option={option}
					features={isInExpressionMode ? ExpressionModeFeatures : features}
					imagePreviewNode={imagePreviewNode}
				/>
				{isInExpressionMode && (
					<ExpressionValuePreview
						expression={stringifyVariableValue(rawValue?.value) ?? ''}
						controlId={controlId ?? null}
						fieldDefinition={option}
					/>
				)}
			</FormLabel>
			<Grid.Col sm={8} className={classNames({ displayNone: !visibility })}>
				{control}
				{description && <div className="form-text">{description}</div>}
			</Grid.Col>
		</>
	)
})

interface OptionsInputControlProps {
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

export interface InputFeatureIconsProps {
	variables?: boolean
	local?: boolean
}

export function InputFeatureIcons(props: InputFeatureIconsProps): JSX.Element | null {
	const featureIcons: JSX.Element[] = []
	if (props.variables)
		featureIcons.push(
			<InlineHelpCustom key="variables" help="Supports global variables">
				<FontAwesomeIcon icon={faDollarSign} />
			</InlineHelpCustom>
		)
	if (props.local)
		featureIcons.push(
			<InlineHelpCustom key="local" help="Supports local variables">
				<FontAwesomeIcon icon={faGlobe} />
			</InlineHelpCustom>
		)

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
	} else if (option.type === 'expression') {
		return ExpressionModeFeatures
	}
	return undefined
}
