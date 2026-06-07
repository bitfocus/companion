import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { useCallback, useId } from 'react'
import type { JsonValue } from 'type-fest'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { ExpressionModeFeatures, InputFeatureIcons, type InputFeatureIconsProps } from '~/Controls/InputFeatures.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { FieldOrExpression } from './FieldOrExpression.js'
import { FormLabel } from './Form.js'
import { Grid } from './Grid.js'
import { InlineHelpIcon } from './InlineHelp.js'

type SetInnerValueFn = (value: JsonValue | undefined) => void

export interface PropertyFieldRowProps {
	label: string
	tooltip?: string
	features?: InputFeatureIconsProps
	isOverridden?: boolean
	value: ExpressionOrValue<JsonValue | undefined>
	setValue: (value: ExpressionOrValue<JsonValue | undefined>) => void
	disableAutoExpression?: boolean
	localVariablesStore: LocalVariablesStore | null
	entityType: EntityModelType | null
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
	features,
	isOverridden,
	value,
	setValue,
	disableAutoExpression,
	localVariablesStore,
	entityType,
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

	return (
		<>
			<FormLabel
				htmlFor={inputId}
				className={classNames('col-sm-4 col-form-label col-form-label-sm', labelClassName, { displayNone: hidden })}
			>
				{label}
				{activeFeatures && <InputFeatureIcons {...activeFeatures} />}
				{tooltip && <InlineHelpIcon className="ms-1">{tooltip}</InlineHelpIcon>}
				{isOverridden && (
					<span title="Value has a linked feedback override">
						<FontAwesomeIcon icon={faLayerGroup} />
					</span>
				)}
			</FormLabel>
			<Grid.Col sm={8} className={classNames({ displayNone: hidden })}>
				{disableAutoExpression ? (
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
				)}
			</Grid.Col>
		</>
	)
}
