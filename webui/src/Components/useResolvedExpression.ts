import { useSubscription } from '@trpc/tanstack-react-query'
import { useMemo, useRef } from 'react'
import type { JsonValue } from 'type-fest'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import { trpc } from '~/Resources/TRPC.js'
import { useDebounced } from '~/Resources/util.js'

export type ResolvedExpressionResult = { ok: true; value: JsonValue | undefined } | { ok: false; error: string }

/**
 * Subscribes to the expression-stream system and returns the resolved result.
 * The expression should already be debounced by the caller if needed.
 * Returns undefined while waiting for the first result; keeps the last known
 * result while a new one is loading to avoid flicker.
 */
export function useResolvedExpression(
	expression: string,
	controlId: string | null
): {
	isEmpty: boolean
	isParseable: boolean
	result: ResolvedExpressionResult | undefined
} {
	const debouncedExpression = useDebounced(expression, 300)
	const isParseable = useMemo(() => isExpressionParseable(debouncedExpression), [debouncedExpression])

	const trimmedExpression = debouncedExpression.trim()
	const isEmpty = !trimmedExpression

	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: controlId,
				expression: trimmedExpression,
				isVariableString: false,
			},
			{
				enabled: !isEmpty && isParseable,
			}
		)
	)

	// Keep the last known result so callers don't flicker back to undefined when expression changes
	const lastDataRef = useRef(sub.data)
	if (sub.data) lastDataRef.current = sub.data

	if (isEmpty || !isParseable) {
		return {
			isEmpty,
			isParseable,
			result: undefined,
		}
	}

	let result: ResolvedExpressionResult | undefined

	const data = sub.data ?? lastDataRef.current
	if (data) result = data.ok ? { ok: true, value: data.value } : { ok: false, error: data.error }

	return {
		isEmpty: false,
		isParseable: true,
		result,
	}
}

function isExpressionParseable(value: string): boolean {
	try {
		ParseExpression(value)
		return true
	} catch {
		return false
	}
}
