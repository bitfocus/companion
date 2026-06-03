import { useEffect, useState } from 'react'
import { PulseLoader } from 'react-spinners'
import type { JsonValue } from 'type-fest'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { StaticAlert } from './Alert.js'
import { useResolvedExpression, type ResolvedExpressionResult } from './useResolvedExpression.js'
import { VariableValueDisplayPopover } from './VariableValueDisplay.js'

interface ExpressionValuePreviewProps {
	expression: string
	controlId: string | null
	fieldDefinition: SomeCompanionInputField
}

export function ExpressionValuePreview({
	expression,
	controlId,
	fieldDefinition,
}: ExpressionValuePreviewProps): React.JSX.Element | null {
	// useResolvedExpression debounces internally
	const { result, isEmpty, isParseable } = useResolvedExpression(expression, controlId)

	if (isEmpty) return null

	if (!isParseable) {
		return (
			<StaticAlert
				color="warning"
				className="mt-1 mb-0"
				style={{ display: 'inline-block', border: 'none', fontWeight: '500', padding: '0.375rem 1rem' }}
			>
				Invalid expression
			</StaticAlert>
		)
	}

	return <ExpressionValuePreviewInner result={result} fieldDefinition={fieldDefinition} />
}

interface ExpressionValuePreviewInnerProps {
	result: ResolvedExpressionResult | undefined
	fieldDefinition: SomeCompanionInputField
}

function ExpressionValuePreviewInner({ result, fieldDefinition }: ExpressionValuePreviewInnerProps) {
	// Only show spinner after 200ms of no data (first load only — subsequent loads show the old result)
	const [showSpinner, setShowSpinner] = useState(false)
	useEffect(() => {
		if (result !== undefined) {
			setShowSpinner(false)
			return
		}
		const timer = setTimeout(() => setShowSpinner(true), 200)
		return () => clearTimeout(timer)
	}, [result])

	if (result === undefined) {
		if (!showSpinner) return null
		return (
			<div className="mt-1">
				<PulseLoader size="0.5rem" title="Loading preview" />
			</div>
		)
	}

	if (!result.ok) {
		return (
			<StaticAlert color="danger" className="mt-1 mb-0 py-1 px-2" style={{ fontSize: '0.85em' }}>
				Error: {result.error}
			</StaticAlert>
		)
	}

	const validationResult = validateExpressionResult(fieldDefinition, result.value)

	return (
		<div className="mt-1">
			<VariableValueDisplayPopover value={result.value} showCopy={false} invalidReason={validationResult} />
		</div>
	)
}

/**
 * Validate the expression result against the field definition.
 * For expression-type fields, we can't validate the result type since the definition
 * doesn't specify a return type. For other field types (e.g. number fields toggled to
 * expression mode), we delegate to validateInputValue.
 */
function validateExpressionResult(
	fieldDefinition: SomeCompanionInputField,
	value: JsonValue | undefined
): string | undefined {
	if (fieldDefinition.allowInvalidValues) return undefined

	const { validationError } = validateInputValue(fieldDefinition, value, {
		skipValidateExpression: true,
	})
	return validationError
}
