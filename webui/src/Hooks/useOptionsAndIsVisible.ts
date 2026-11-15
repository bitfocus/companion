import { toJS } from 'mobx'
import type { JsonValue } from 'type-fest'
import { getCompiledIsVisibleExpressionFn } from '@companion-app/shared/IsVisible.js'
import {
	convertExpressionOptionsWithoutParsing,
	type ExpressionableOptionsObject,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { sandbox } from '~/Resources/sandbox.js'
import { assertNever, deepFreeze, useComputed } from '~/Resources/util.js'

export type IsVisibleFn = (
	options: CompanionOptionValues,
	getOptionValue?: (id: string) => JsonValue | undefined
) => boolean

export function useOptionsVisibility(
	itemOptions: Array<SomeCompanionInputField> | undefined | null,
	optionValues: ExpressionableOptionsObject | undefined | null
): ReadonlyMap<string, boolean> {
	const [isVisibleFns, allowedReferences] = useComputed(() => {
		const isVisibleFns = new Map<string, { fn: IsVisibleFn; readsAllOptions: boolean }>()
		const allowedReferences = new Set<string>()

		for (const option of itemOptions ?? []) {
			const isVisibleFn = parseIsVisibleFn(option)
			// A function (only from 1.x modules) is given every option, all of which are plain values
			if (isVisibleFn)
				isVisibleFns.set(option.id, { fn: isVisibleFn, readsAllOptions: option.isVisibleUi?.type === 'function' })
			if (option.disableAutoExpression && option.type !== 'expression') allowedReferences.add(option.id)
		}

		return [isVisibleFns, allowedReferences]
	}, [itemOptions])

	return useComputed<ReadonlyMap<string, boolean>>(() => {
		const visibility = new Map<string, boolean>()

		if (!optionValues) return visibility

		let allOptions: CompanionOptionValues | undefined
		const restrictedGetOptionValue = createRestrictedGetOptionValue(
			allowedReferences,
			(optionId) => optionValues[optionId]?.value
		)

		for (const [id, { fn, readsAllOptions }] of isVisibleFns) {
			try {
				if (readsAllOptions) {
					allOptions ??= convertExpressionOptionsWithoutParsing(structuredClone(toJS(optionValues)))
					visibility.set(id, fn(allOptions))
				} else {
					visibility.set(id, fn({}, restrictedGetOptionValue))
				}
			} catch (e) {
				console.error('Failed to check visibility', e)
			}
		}

		return visibility
	}, [isVisibleFns, optionValues, allowedReferences])
}

/**
 * Wrap an option value getter so that an `isVisible` expression can only read the options in `allowedReferences`
 * (those which can't be expressions), throwing for any other
 */
export function createRestrictedGetOptionValue(
	allowedReferences: ReadonlySet<string>,
	getOptionValue: (id: string) => JsonValue | undefined
): (id: string) => JsonValue | undefined {
	return (optionId) => {
		if (!allowedReferences.has(optionId))
			throw new Error(`Access to option "${optionId}" not allowed, as it is either unknown or can be an expression.`)
		return getOptionValue(optionId)
	}
}

export function usePlainOptionsVisibility(
	itemOptions: Array<SomeCompanionInputField> | undefined | null,
	optionValues: Record<string, JsonValue | undefined> | undefined | null
): ReadonlyMap<string, boolean> {
	return useComputed<ReadonlyMap<string, boolean>>(() => {
		const visibility = new Map<string, boolean>()

		if (!optionValues) return visibility

		for (const option of itemOptions ?? []) {
			try {
				const isVisibleFn = parseIsVisibleFn(option)
				if (!isVisibleFn) continue

				const simpleOptions = structuredClone(toJS(optionValues))
				visibility.set(option.id, isVisibleFn(simpleOptions))
			} catch (e) {
				console.error('Failed to check visibility', e)
			}
		}

		return visibility
	}, [itemOptions, optionValues])
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
				const compiled = getCompiledIsVisibleExpressionFn(option.isVisibleUi)
				if (!compiled) return null
				const userData = deepFreeze(toJS(option.isVisibleUi.data))
				return (optionsRaw: CompanionOptionValues, getOptionValue?: (id: string) => JsonValue | undefined) => {
					const options = toJS(optionsRaw)
					return compiled(getOptionValue ?? ((name) => options[name]), userData)
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
