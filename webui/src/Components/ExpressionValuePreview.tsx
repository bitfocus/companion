import React, { useMemo, useState, useEffect, useCallback, useContext } from 'react'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC.js'
import { CAlert, CSpinner } from '@coreui/react'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { VariableValueDisplay } from './VariableValueDisplay.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { JsonValue } from 'type-fest'

interface ExpressionValuePreviewProps {
	expression: string
	controlId: string | null
	fieldDefinition: SomeCompanionInputField
}

function useDebounced<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs)
		return () => clearTimeout(timer)
	}, [value, delayMs])
	return debounced
}

function isExpressionParseable(value: string): boolean {
	try {
		ParseExpression(value)
		return true
	} catch {
		return false
	}
}

export function ExpressionValuePreview({
	expression,
	controlId,
	fieldDefinition,
}: ExpressionValuePreviewProps): React.JSX.Element {
	const debouncedExpression = useDebounced(expression, 300)
	const isParseable = useMemo(() => isExpressionParseable(debouncedExpression), [debouncedExpression])

	if (!isParseable) {
		return (
			<CAlert color="warning" className="mt-1 mb-0 py-1 px-2" style={{ fontSize: '0.85em' }}>
				Invalid expression syntax
			</CAlert>
		)
	}

	return (
		<ExpressionValuePreviewInner
			expression={debouncedExpression}
			controlId={controlId}
			fieldDefinition={fieldDefinition}
		/>
	)
}

function ExpressionValuePreviewInner({ expression, controlId, fieldDefinition }: ExpressionValuePreviewProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const onCopied = useCallback(() => notifier.show('Copied', 'Copied to clipboard', 3000), [notifier])

	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: controlId,
				expression: expression,
				isVariableString: false,
			},
			{}
		)
	)

	if (!sub.data) {
		return (
			<div className="mt-1">
				<CSpinner size="sm" />
			</div>
		)
	}

	if (!sub.data.ok) {
		return (
			<CAlert color="danger" className="mt-1 mb-0 py-1 px-2" style={{ fontSize: '0.85em' }}>
				Error: {sub.data.error}
			</CAlert>
		)
	}

	const validationResult = validateExpressionResult(fieldDefinition, sub.data.value)

	return (
		<div className="mt-1">
			<VariableValueDisplay
				value={sub.data.value}
				onCopied={onCopied}
				showCopy={false}
				style={validationResult ? { color: '#c83232', backgroundColor: '#f9e5e5' } : undefined}
			/>
			{validationResult && (
				<CAlert color="warning" className="mt-1 mb-0 py-1 px-2" style={{ fontSize: '0.85em' }}>
					{validationResult}
				</CAlert>
			)}
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
	const { validationError } = validateInputValue(fieldDefinition, value, {
		skipValidateExpression: true,
	})
	return validationError
}
