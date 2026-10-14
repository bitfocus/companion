import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { useCallback, useId } from 'react'
import type { JsonValue } from 'type-fest'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type {
	ExpressionableOptionsObject,
	ExpressionOrValue,
	SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { ExpressionModeFeatures, InputFeatureIcons, type InputFeatureIconsProps } from '~/Controls/InputFeatures.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { buildContextResolutionForPreview, ExpressionValuePreview } from './ExpressionValuePreview.js'
import { FieldOrExpression } from './FieldOrExpression.js'
import { FormLabel } from './Form.js'
import { InlineHelpIcon } from './InlineHelp.js'

type SetInnerValueFn = (value: JsonValue | undefined) => void

export interface PropertyFieldRowProps {
	label: string
	tooltip?: string
	/** Hint shown below the field. Replaced by expressionDescription when in expression mode. */
	description?: string
	/** Hint shown below the field when in expression mode, in place of description. */
	expressionDescription?: string
	features?: InputFeatureIconsProps
	/** Control for pinning/unpinning this property, shown at the end of the label */
	pinToggle?: React.ReactNode
	isOverridden?: boolean
	value: ExpressionOrValue<JsonValue | undefined>
	setValue: (value: ExpressionOrValue<JsonValue | undefined>) => void
	disableAutoExpression?: boolean
	localVariablesStore: LocalVariablesStore | null
	entityType: EntityModelType | null
	/** The field definition, used to render the evaluated value preview when in expression mode */
	fieldDefinition: SomeCompanionInputField
	/** The control this field belongs to, for evaluating the expression preview */
	controlId: string | null
	/** Sibling field values, used to resolve context-variable overrides for the preview */
	allRawOptions: ExpressionableOptionsObject | undefined
	isLocatedInGrid: boolean
	disabled: boolean
	hidden?: boolean
	labelClassName?: string
	children: (
		value: { value: JsonValue | undefined },
		setInnerValue: SetInnerValueFn,
		inputId: string
	) => React.ReactNode
}

export function PropertyFieldRow({
	label,
	tooltip,
	description,
	expressionDescription,
	features,
	pinToggle,
	isOverridden,
	value,
	setValue,
	disableAutoExpression,
	localVariablesStore,
	entityType,
	fieldDefinition,
	controlId,
	allRawOptions,
	isLocatedInGrid,
	disabled,
	hidden = false,
	labelClassName,
	children,
}: PropertyFieldRowProps): React.ReactNode {
	const inputId = useId()

	const setInnerValue = useCallback(
		(innerValue: JsonValue | undefined) => setValue({ isExpression: false, value: innerValue }),
		[setValue]
	)

	const activeFeatures = value.isExpression ? ExpressionModeFeatures : features
	const activeDescription =
		value.isExpression && expressionDescription !== undefined ? expressionDescription : description

	const inputControl = disableAutoExpression ? (
		children({ value: value.value }, setInnerValue, inputId)
	) : (
		<FieldOrExpression
			inputId={inputId}
			value={value}
			setValue={setValue}
			localVariablesStore={localVariablesStore}
			entityType={entityType}
			isLocatedInGrid={isLocatedInGrid}
			disabled={disabled}
		>
			{children({ value: value.value }, setInnerValue, inputId)}
		</FieldOrExpression>
	)

	return (
		<div className={classNames('property-inspector-row', { hidden })}>
			<FormLabel htmlFor={inputId} className={classNames('property-inspector-label', labelClassName)}>
				{label}
				{activeFeatures && <InputFeatureIcons {...activeFeatures} />}
				{tooltip && <InlineHelpIcon className="ms-1">{tooltip}</InlineHelpIcon>}
				{value.isExpression && (
					<ExpressionValuePreview
						expression={stringifyVariableValue(value.value) ?? ''}
						controlId={controlId}
						fieldDefinition={fieldDefinition}
						contextResolution={buildContextResolutionForPreview(
							fieldDefinition.contextVariableResolution,
							allRawOptions
						)}
					/>
				)}
			</FormLabel>
			<div className="property-inspector-input">{inputControl}</div>
			<div className="property-inspector-pin">{pinToggle}</div>
			{isOverridden && (
				<div className="property-inspector-status">
					<span title="Value has a linked feedback override">
						<FontAwesomeIcon icon={faLayerGroup} /> Linked feedback
					</span>
				</div>
			)}
			{activeDescription && <div className="property-inspector-description">{activeDescription}</div>}
		</div>
	)
}
