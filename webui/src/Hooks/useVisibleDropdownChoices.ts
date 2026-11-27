import { getCompiledIsVisibleExpressionFn } from '@companion-app/shared/IsVisible.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { ExpressionableOptionsObject, IsVisibleUiFn } from '@companion-app/shared/Model/Options.js'
import { useComputed } from '~/Resources/util.js'

const definitions = new WeakMap<DropdownChoice, IsVisibleUiFn>()

export function useVisibleDropdownChoices(
	choices: DropdownChoice[] | undefined,
	options: ExpressionableOptionsObject | undefined
): DropdownChoice[] {
	return useComputed(() => {
		return (choices ?? []).filter((choice) => {
			if (!choice.isVisibleExpression || !options) return true
			try {
				let definition = definitions.get(choice)
				if (!definition || definition.fn !== choice.isVisibleExpression) {
					definition = { type: 'expression', fn: choice.isVisibleExpression }
					definitions.set(choice, definition)
				}
				const fn = getCompiledIsVisibleExpressionFn(definition)
				return (
					fn?.((id) => {
						const option = options[id]
						if (!option || option.isExpression) throw new Error(`Option "${id}" is not a literal value`)
						return option.value
					}, undefined) ?? true
				)
			} catch {
				return true
			}
		})
	}, [choices, options])
}
