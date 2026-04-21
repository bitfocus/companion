import { CAlert, CSpinner } from '@coreui/react'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { JsonValue } from 'type-fest'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { trpc } from '~/Resources/TRPC.js'
import { useDebounced } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { VariableValueDisplayPopover } from './VariableValueDisplay.js'

interface ExpressionValuePreviewProps {
	expression: string
	controlId: string | null
	fieldDefinition: SomeCompanionInputField
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
}: ExpressionValuePreviewProps): React.JSX.Element | null {
	const debouncedExpression = useDebounced(expression, 300)
	const isParseable = useMemo(() => isExpressionParseable(debouncedExpression), [debouncedExpression])

	if (!debouncedExpression.trim()) {
		return null
	}

	if (!isParseable) {
		return (
			<CAlert
				color="warning"
				className="mt-1 mb-0"
				style={{ display: 'inline-block', border: 'none', fontWeight: '500', padding: '0.375rem 1rem' }}
			>
				Invalid expression
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

	// Keep the last known result so we can show it while waiting for new data
	const lastDataRef = useRef(sub.data)
	if (sub.data) {
		lastDataRef.current = sub.data
	}

	// Only show spinner after 200ms of no data
	const [showSpinner, setShowSpinner] = useState(false)
	useEffect(() => {
		if (sub.data) {
			setShowSpinner(false)
			return
		}
		const timer = setTimeout(() => setShowSpinner(true), 200)
		return () => clearTimeout(timer)
	}, [sub.data])

	const displayData = sub.data ?? lastDataRef.current

	if (!displayData) {
		if (!showSpinner) return null
		return (
			<div className="mt-1">
				<CSpinner size="sm" />
			</div>
		)
	}

	if (!displayData.ok) {
		return (
			<CAlert color="danger" className="mt-1 mb-0 py-1 px-2" style={{ fontSize: '0.85em' }}>
				Error: {displayData.error}
			</CAlert>
		)
	}

	const validationResult = validateExpressionResult(fieldDefinition, displayData.value)

	return (
		<div className="mt-1">
			<VariableValueDisplayPopover
				value={displayData.value}
				onCopied={onCopied}
				showCopy={false}
				invalidReason={validationResult}
			/>
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
