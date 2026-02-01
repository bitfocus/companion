import {
	convertExpressionOptionsWithoutParsing,
	type ExpressionableOptionsObject,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { assertNever, deepFreeze, useComputed } from '~/Resources/util.js'
import { sandbox } from '~/Resources/sandbox.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { toJS } from 'mobx'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import { type GetVariableValueProps, ResolveExpression } from '@companion-app/shared/Expression/ExpressionResolve.js'
import { ExpressionFunctions } from '@companion-app/shared/Expression/ExpressionFunctions.js'
import type { JsonValue } from 'type-fest'

export type IsVisibleFn = (
	options: CompanionOptionValues,
	getOptionValue?: (id: string) => JsonValue | undefined
) => boolean

export function useOptionsVisibility(
	itemOptions: Array<SomeCompanionInputField> | undefined | null,
	optionsSupportExpressions: boolean,
	optionValues: ExpressionableOptionsObject | undefined | null
): ReadonlyMap<string, boolean> {
	const [isVisibleFns, allowedReferences] = useComputed(() => {
		const isVisibleFns = new Map<string, IsVisibleFn>()
		const allowedReferences = new Set<string>()

		for (const option of itemOptions ?? []) {
			const isVisibleFn = parseIsVisibleFn(option)
			if (isVisibleFn) isVisibleFns.set(option.id, isVisibleFn)
			if (option.disableAutoExpression) allowedReferences.add(option.id)
		}

		return [isVisibleFns, allowedReferences]
	}, [itemOptions])

	return useComputed<ReadonlyMap<string, boolean>>(() => {
		const visibility = new Map<string, boolean>()

		if (!optionValues) return visibility

		for (const [id, entry] of isVisibleFns) {
			try {
				if (entry && typeof entry === 'function') {
					if (optionsSupportExpressions) {
						// We only support the expression syntax functions here
						const restrictedGetOptionValue = (optionId: string): JsonValue | undefined => {
							if (!allowedReferences.has(optionId))
								throw new Error(
									`Access to option "${optionId}" not allowed, as it is either unknown or can be an expression.`
								)
							return optionValues[optionId]?.value
						}
						visibility.set(id, entry({}, restrictedGetOptionValue))
					} else {
						// Fallback to simpler behaviour
						const simpleOptions = convertExpressionOptionsWithoutParsing(structuredClone(toJS(optionValues)))
						visibility.set(id, entry(simpleOptions))
					}
				}
			} catch (e) {
				console.error('Failed to check visibility', e)
			}
		}

		return visibility
	}, [isVisibleFns, optionValues, allowedReferences, optionsSupportExpressions])
}

export function parseIsVisibleFn(option: SomeCompanionInputField): IsVisibleFn | null {
	try {
		if (!option.isVisibleUi) return null

		switch (option.isVisibleUi.type) {
			case 'function': {
				const fn = sandbox(option.isVisibleUi.fn)
				const userData = deepFreeze(toJS(option.isVisibleUi.data))
				return (options: CompanionOptionValues) => fn(options, userData)
			}
			case 'expression': {
				const expression = ParseExpression(option.isVisibleUi.fn)
				const userData = deepFreeze(toJS(option.isVisibleUi.data))
				return (optionsRaw: CompanionOptionValues, getOptionValue?: (id: string) => JsonValue | undefined) => {
					try {
						const options = toJS(optionsRaw)
						const val = ResolveExpression(
							expression,
							(props: GetVariableValueProps) => {
								if (props.label === 'this' || props.label === 'options') {
									return getOptionValue ? getOptionValue(props.name) : options[props.name]
								} else if (props.label === 'data') {
									return userData[props.name]
								} else {
									throw new Error(`Unknown variable "${props.variableId}"`)
								}
							},
							ExpressionFunctions
						)
						return !!val && val !== 'false' && val !== '0'
					} catch (e) {
						console.error('Failed to resolve expression', e)
						return true
					}
				}
			}
			default:
				assertNever(option.isVisibleUi.type)
				return null
		}
	} catch (e) {
		console.error('Failed to process isVisibleFn', e)
		return null
	}
}
