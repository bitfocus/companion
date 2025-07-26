import type {
	ExtendedConfigField,
	ExtendedInputField,
	InternalInputField,
} from '@companion-app/shared/Model/Options.js'
import { assertNever, deepFreeze, useComputed } from '~/Resources/util.js'
import { sandbox } from '~/Resources/sandbox.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { cloneDeep } from 'lodash-es'
import { toJS } from 'mobx'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import { ResolveExpression } from '@companion-app/shared/Expression/ExpressionResolve.js'
import { ExpressionFunctions } from '@companion-app/shared/Expression/ExpressionFunctions.js'

export function useOptionsVisibility<
	T extends ExtendedInputField | InternalInputField = ExtendedInputField | InternalInputField,
>(
	itemOptions: Array<T> | undefined | null,
	optionValues: CompanionOptionValues | undefined | null
): Record<string, boolean | undefined> {
	const isVisibleFns = useOptionsAndIsVisibleFns(itemOptions)

	return useComputed<Record<string, boolean | undefined>>(() => {
		const visibility: Record<string, boolean> = {}

		if (optionValues) {
			for (const [id, entry] of Object.entries(isVisibleFns)) {
				try {
					if (entry && typeof entry === 'function') {
						visibility[id] = entry(cloneDeep(toJS(optionValues)))
					}
				} catch (e) {
					console.error('Failed to check visibility', e)
				}
			}
		}

		return visibility
	}, [isVisibleFns, optionValues])
}

function useOptionsAndIsVisibleFns<
	T extends ExtendedInputField | InternalInputField | ExtendedConfigField = ExtendedInputField | InternalInputField,
>(itemOptions: Array<T> | undefined | null): Record<string, ((options: CompanionOptionValues) => boolean) | undefined> {
	return useComputed(() => {
		const isVisibleFns: Record<string, (options: CompanionOptionValues) => boolean> = {}

		for (const option of itemOptions ?? []) {
			const isVisibleFn = parseIsVisibleFn(option)
			if (isVisibleFn) isVisibleFns[option.id] = isVisibleFn
		}

		return isVisibleFns
	}, [itemOptions])
}

export function parseIsVisibleFn<
	T extends ExtendedInputField | InternalInputField | ExtendedConfigField = ExtendedInputField | InternalInputField,
>(option: T): ((options: CompanionOptionValues) => boolean) | null {
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
				return (options: CompanionOptionValues) => {
					try {
						const val = ResolveExpression(
							expression,
							(name) => {
								if (name.startsWith('this:')) {
									return options[name.slice(5)] as any
								} else if (name.startsWith('options:')) {
									return options[name.slice(8)] as any
								} else if (name.startsWith('data:')) {
									return userData[name.slice(5)]
								} else {
									return undefined
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
