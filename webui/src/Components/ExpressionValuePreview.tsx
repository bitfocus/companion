import { useSubscription } from '@trpc/tanstack-react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { PulseLoader } from 'react-spinners'
import type { JsonValue } from 'type-fest'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import type { ExpressionStreamResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type {
	ContextVariableResolution,
	ExpressionableOptionsObject,
	ExpressionOrValue,
	SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { trpc } from '~/Resources/TRPC.js'
import { useDebounced } from '~/Resources/util.js'
import { StaticAlert } from './Alert.js'
import { VariableValueDisplayPopover } from './VariableValueDisplay.js'

type ContextResolutionForPreview =
	| {
			type: 'localVariable'
			locationValue: ExpressionOrValue<JsonValue | undefined> | undefined
			nameValue: ExpressionOrValue<JsonValue | undefined> | undefined
	  }
	| { type: 'customVariable'; nameValue: ExpressionOrValue<JsonValue | undefined> | undefined }

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
			locationValue: allRawOptions[res.locationFieldId],
			nameValue: allRawOptions[res.nameFieldId],
		}
	}
	return {
		type: 'customVariable',
		nameValue: allRawOptions[res.nameFieldId],
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

interface ExpressionPreviewResultProps {
	data: ExpressionStreamResult
	fieldDefinition: SomeCompanionInputField
}

export function ExpressionPreviewResult({ data, fieldDefinition }: ExpressionPreviewResultProps): React.JSX.Element {
	if (!data.ok) {
		return (
			<StaticAlert color="danger" className="mt-1 mb-0 py-1 px-2" style={{ fontSize: '0.85em' }}>
				Error: {data.error}
			</StaticAlert>
		)
	}

	const validationResult = validateExpressionResult(fieldDefinition, data.value)

	return (
		<div className="mt-1">
			<VariableValueDisplayPopover value={data.value} showCopy={false} invalidReason={validationResult} />
		</div>
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

	// Only run the (potentially expensive) subscription while this preview is on screen.
	// The DOM stays mounted either way, so the last-known value remains visible and there is no
	// layout change as the preview scrolls in and out of view.
	const { ref: inViewRef, inView } = useInView({ rootMargin: '200px 0px' })

	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: controlId,
				expression: expression,
				isVariableString: false,
				contextResolution: serverContextResolution,
			},
			{ enabled: inView }
		)
	)

	// Keep the last known result so we can show it while waiting for new data
	const lastDataRef = useRef(sub.data)
	if (sub.data) {
		lastDataRef.current = sub.data
	}

	// Only show spinner after 200ms of no data (and only while subscribed/visible)
	const [showSpinner, setShowSpinner] = useState(false)
	useEffect(() => {
		if (sub.data || !inView) {
			setShowSpinner(false)
			return
		}
		const timer = setTimeout(() => setShowSpinner(true), 200)
		return () => clearTimeout(timer)
	}, [sub.data, inView])

	const displayData = sub.data ?? lastDataRef.current

	let content: React.JSX.Element | null
	if (!displayData) {
		content = showSpinner ? (
			<div className="mt-1">
				<PulseLoader size="0.5rem" title="Loading preview" />
			</div>
		) : null
	} else {
		content = <ExpressionPreviewResult data={displayData as ExpressionStreamResult} fieldDefinition={fieldDefinition} />
	}

	// Always render an anchor element so the intersection observer has a stable target to watch,
	// even when there is nothing to display yet.
	return <div ref={inViewRef}>{content}</div>
}

function resolveServerContextResolution(ctx: ContextResolutionForPreview | undefined):
	| {
			type: 'localVariable'
			locationValue: ExpressionOrValue<JsonValue | undefined>
			nameValue: ExpressionOrValue<JsonValue | undefined>
	  }
	| { type: 'customVariable'; nameValue: ExpressionOrValue<JsonValue | undefined> }
	| undefined {
	if (!ctx) return undefined
	if (ctx.type === 'localVariable') {
		if (!ctx.locationValue || !ctx.nameValue) return undefined
		return { type: 'localVariable', locationValue: ctx.locationValue, nameValue: ctx.nameValue }
	}
	if (!ctx.nameValue) return undefined
	return { type: 'customVariable', nameValue: ctx.nameValue }
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
