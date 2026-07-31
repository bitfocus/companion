import type { JsonValue } from 'type-fest'
import { ParseExpression, ResolveExpression } from './Expressions.js'
import type { IsVisibleUiFn } from './Model/Options.js'

/** Accessor for a sibling option's value, used to resolve `$(this|options:name)` references */
export type IsVisibleOptionAccessor = (name: string) => JsonValue | undefined

/**
 * A compiled `isVisible` expression. Returns whether the field should be visible, given an
 * accessor for sibling option values and the static `data` for `$(data:name)` references.
 */
export type CompiledIsVisibleExpressionFn = (
	getOptionValue: IsVisibleOptionAccessor,
	data: Record<string, any> | undefined
) => boolean

// The parsed expression is cached against the definition object, which is stable across parses
const compiledCache = new WeakMap<IsVisibleUiFn, CompiledIsVisibleExpressionFn>()

/**
 * Compile the `expression` form of an `isVisible` definition into a reusable evaluator.
 * Returns `null` for the `function` form - that is a stringified module function and must only
 * ever be run inside the frontend sandbox, never on the backend.
 *
 * This is the single source of truth for expression visibility, shared between the webui hook
 * and the backend options parser so their semantics cannot diverge.
 */
export function getCompiledIsVisibleExpressionFn(isVisibleUi: IsVisibleUiFn): CompiledIsVisibleExpressionFn | null {
	if (isVisibleUi.type !== 'expression') return null

	const cached = compiledCache.get(isVisibleUi)
	if (cached) return cached

	const expression = ParseExpression(isVisibleUi.fn)

	const fn: CompiledIsVisibleExpressionFn = (getOptionValue, data) => {
		try {
			const val = ResolveExpression(expression, {
				// Config-match expressions should be trivial - keep the budget tight
				maxOperations: 1000,
				maxCallDepth: 16,

				getVariableValue: (props) => {
					if (props.label === 'this' || props.label === 'options') {
						return getOptionValue(props.name)
					} else if (props.label === 'data') {
						if (!data) throw new Error(`Unknown variable "${props.variableId}"`)
						return data[props.name]
					} else {
						throw new Error(`Unknown variable "${props.variableId}"`)
					}
				},
				parseVariables: null, // Not supported here
				blink: undefined, // Not supported here

				defaultTimezone: undefined, // no timezone context
			})
			return !!val && val !== 'false' && val !== '0'
		} catch (_e) {
			// Fail open: if visibility can't be determined, treat the field as visible
			return true
		}
	}

	compiledCache.set(isVisibleUi, fn)
	return fn
}
