import { useSubscription } from '@trpc/tanstack-react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PulseLoader } from 'react-spinners'
import type { JsonValue } from 'type-fest'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import type {
	ContextVariableResolution,
	ExpressionableOptionsObject,
	SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { trpc } from '~/Resources/TRPC.js'
import { useDebounced } from '~/Resources/util.js'
import { StaticAlert } from './Alert.js'
import { VariableValueDisplayPopover } from './VariableValueDisplay.js'

type ContextResolutionForPreview =
	| { type: 'localVariable'; location: string | null; name: string | null }
	| { type: 'customVariable'; name: string | null }

interface ExpressionValuePreviewProps {
	expression: string
	controlId: string | null
	fieldDefinition: SomeCompanionInputField
	contextResolution?: ContextResolutionForPreview
}

function isExpressionParseable(value: string): boolean {
	try {
		ParseExpression(value)
		return true
	} catch {
		return false
	}
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildContextResolutionForPreview(
	res: ContextVariableResolution | undefined,
	allRawOptions: ExpressionableOptionsObject | undefined
): ContextResolutionForPreview | undefined {
	if (!res || !allRawOptions) return undefined
	if (res.type === 'localVariable') {
		return {
			type: 'localVariable',
			location: stringifyVariableValue(allRawOptions[res.locationFieldId]?.value) ?? null,
			name: stringifyVariableValue(allRawOptions[res.nameFieldId]?.value) ?? null,
		}
	}
	return {
		type: 'customVariable',
		name: stringifyVariableValue(allRawOptions[res.nameFieldId]?.value) ?? null,
	}
}

export function ExpressionValuePreview({
	expression,
	controlId,
	fieldDefinition,
	contextResolution,
}: ExpressionValuePreviewProps): React.JSX.Element | null {
	const debouncedExpression = useDebounced(expression, 300)
	const isParseable = useMemo(() => isExpressionParseable(debouncedExpression), [debouncedExpression])

	if (!debouncedExpression.trim()) {
		return null
	}

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

	return (
		<ExpressionValuePreviewInner
			expression={debouncedExpression}
			controlId={controlId}
			fieldDefinition={fieldDefinition}
			contextResolution={contextResolution}
		/>
	)
}

function ExpressionValuePreviewInner({
	expression,
	controlId,
	fieldDefinition,
	contextResolution,
}: ExpressionValuePreviewProps) {
	// Resolve the context resolution to a form the server accepts (non-null values only)
	const serverContextResolution = resolveServerContextResolution(contextResolution)

	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: controlId,
				expression: expression,
				isVariableString: false,
				contextResolution: serverContextResolution,
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
				<PulseLoader size="0.5rem" title="Loading preview" />
			</div>
		)
	}

	if (!displayData.ok) {
		return (
			<StaticAlert color="danger" className="mt-1 mb-0 py-1 px-2" style={{ fontSize: '0.85em' }}>
				Error: {displayData.error}
			</StaticAlert>
		)
	}

	const validationResult = validateExpressionResult(fieldDefinition, displayData.value)

	return (
		<div className="mt-1">
			<VariableValueDisplayPopover value={displayData.value} showCopy={false} invalidReason={validationResult} />
		</div>
	)
}

function resolveServerContextResolution(
	ctx: ContextResolutionForPreview | undefined
): { type: 'localVariable'; location: string; name: string } | { type: 'customVariable'; name: string } | undefined {
	if (!ctx) return undefined
	if (ctx.type === 'localVariable') {
		if (!ctx.location || !ctx.name) return undefined
		return { type: 'localVariable', location: ctx.location, name: ctx.name }
	}
	if (!ctx.name) return undefined
	return { type: 'customVariable', name: ctx.name }
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
