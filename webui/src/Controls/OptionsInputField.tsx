import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useId } from 'react'
import type { JsonValue } from 'type-fest'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { type ExpressionOrValue, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { ExpressionValuePreview } from '~/Components/ExpressionValuePreview.js'
import { FieldOrExpression } from '~/Components/FieldOrExpression.js'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { ListInputField } from '~/Components/ListInputField.js'
import { TableInputField } from '~/Components/TableInputField.js'
import {
	ExpressionModeFeatures,
	getInputFeatures,
	InputFeatureIcons,
	type InputFeatureIconsProps,
} from './InputFeatures.js'
import type { LocalVariablesStore } from './LocalVariablesStore.js'
import { OptionsInputControl } from './OptionsInputControl.js'

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

function OptionLabel({ option, features }: { option: SomeCompanionInputField; features?: InputFeatureIconsProps }) {
	return (
		<>
			{option.label}
			<InputFeatureIcons {...features} />
			{option.tooltip && <InlineHelpIcon className="ms-1">{option.tooltip}</InlineHelpIcon>}
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

	if (option.type === 'internal:list') {
		return (
			<ListInputField
				definition={option}
				value={rawValue?.value as Record<string, any>[] | undefined}
				setValue={(val) => setValue(option.id, { isExpression: false, value: val })}
				disabled={!!readonly}
				localVariablesStore={localVariablesStore}
				entityType={entityType}
				isLocatedInGrid={isLocatedInGrid}
				fieldSupportsExpression={fieldSupportsExpression && !option.disableAutoExpression}
				visibility={visibility}
			/>
		)
	}

	if (option.type === 'internal:table') {
		return (
			<TableInputField
				definition={option}
				value={rawValue?.value as Record<string, JsonValue>[] | undefined}
				setValue={(val) => setValue(option.id, { isExpression: false, value: val })}
				disabled={!!readonly}
				localVariablesStore={localVariablesStore}
				entityType={entityType}
				isLocatedInGrid={isLocatedInGrid}
			/>
		)
	}

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
				extraLocalVariables={option.contextVariables}
			>
				{control}
			</FieldOrExpression>
		)

		if (rawExpressionValue?.isExpression) {
			isInExpressionMode = true
		}
	}

	const description =
		isInExpressionMode && option.expressionDescription !== undefined ? option.expressionDescription : option.description

	return (
		<>
			<FormLabel
				htmlFor={inputId}
				className={classNames('col-sm-4 col-form-label col-form-label-sm', { displayNone: !visibility })}
			>
				<OptionLabel option={option} features={isInExpressionMode ? ExpressionModeFeatures : features} />
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
