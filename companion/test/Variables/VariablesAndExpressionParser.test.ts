import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import {
	CompanionFieldVariablesSupport,
	exprExpr,
	exprVal,
	type ExpressionableOptionsObject,
} from '@companion-app/shared/Model/Options.js'
import type { ControlEntityInstance } from '../../lib/Controls/Entities/EntityInstance.js'
import type { VariablesCache, VariableValueData, VisitEntityOptionValueOptions } from '../../lib/Variables/Util.js'
import { VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'
import { mockUserConfig as buildUserConfigMock } from '../utils/MockUserConfig.js'

const useVariablesMinimal = CompanionFieldVariablesSupport.Basic

/** Userconfig mock with no configured timezone (date/time functions use process-local time) */
const mockUserConfig = buildUserConfigMock({ timezone: '' })

function createDefinition(
	partial: Pick<ClientEntityDefinition, 'options'> & Partial<ClientEntityDefinition>
): ClientEntityDefinition {
	return {
		entityType: EntityModelType.Action,
		label: 'Test',
		sortKey: null,
		description: undefined,
		optionsToMonitorForInvalidations: null,
		feedbackType: null,
		feedbackStyle: undefined,
		hasLifecycleFunctions: true,
		hasLearn: false,
		learnTimeout: undefined,
		showInvert: false,
		actionHasResult: false,
		feedbackAffectedProperties: undefined,
		optionsSupportExpressions: false,
		showButtonPreview: false,
		supportsChildGroups: [],
		...partial,
	}
}

describe('VariablesAndExpressionParser', () => {
	// Sample variable data for testing
	const defaultVariables: VariableValueData = {
		test: {
			var1: 'value1',
			var2: 'value2',
			num: 42,
		},
		another: {
			var: 'another-value',
		},
	}

	const createParser = (
		variables: VariableValueData = defaultVariables,
		thisValues: VariablesCache = new Map(),
		localValues: null = null,
		overrideValues: null = null
	): VariablesAndExpressionParser => {
		return new VariablesAndExpressionParser(
			mockUserConfig,
			null as any,
			variables,
			thisValues,
			localValues,
			overrideValues
		)
	}

	describe('parseVariables', () => {
		it('should return unchanged string when no variables present', () => {
			const parser = createParser()
			const result = parser.parseVariables('hello world')

			expect(result.text).toBe('hello world')
			expect(result.variableIds.size).toBe(0)
		})

		it('should parse single variable', () => {
			const parser = createParser()
			const result = parser.parseVariables('$(test:var1)')

			expect(result.text).toBe('value1')
			expect(result.variableIds).toContain('test:var1')
		})

		it('should parse multiple variables', () => {
			const parser = createParser()
			const result = parser.parseVariables('$(test:var1) and $(test:var2)')

			expect(result.text).toBe('value1 and value2')
			expect(result.variableIds).toContain('test:var1')
			expect(result.variableIds).toContain('test:var2')
		})

		it('should handle unknown variables', () => {
			const parser = createParser()
			const result = parser.parseVariables('$(unknown:var)')

			expect(result.text).toBe('$NA')
			expect(result.variableIds).toContain('unknown:var')
		})

		it('should handle empty string', () => {
			const parser = createParser()
			const result = parser.parseVariables('')

			expect(result.text).toBe('')
			expect(result.variableIds.size).toBe(0)
		})
	})

	describe('executeExpression', () => {
		it('should execute basic math expression', () => {
			const parser = createParser()
			const result = parser.executeExpression('1 + 2', undefined)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.value).toBe(3)
			}
		})

		it('should execute expression with variables', () => {
			const parser = createParser()
			const result = parser.executeExpression('$(test:num) * 2', undefined)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.value).toBe(84)
			}
		})

		it('should handle string concatenation', () => {
			const parser = createParser()
			const result = parser.executeExpression("concat($(test:var1), '-', $(test:var2))", undefined)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.value).toBe('value1-value2')
			}
		})

		it('should return error for invalid expression', () => {
			const parser = createParser()
			const result = parser.executeExpression('invalid syntax !!!', undefined)

			expect(result.ok).toBe(false)
		})
	})

	describe('parseEntityOptions', () => {
		it('should parse options with variables in textinput fields', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal },
					{ id: 'field2', type: 'dropdown', label: 'Field 2', choices: [], default: 'opt1' },
				],
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: false, value: '$(test:var1)' },
				field2: { isExpression: false, value: 'option1' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions).toEqual({
					field1: 'value1',
					field2: 'option1',
				})
			}
			expect(result.referencedVariableIds.has('test:var1')).toBe(true)
		})

		it('should pass through non-variable fields unchanged', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [{ id: 'field1', type: 'number', label: 'Field 1', min: 0, max: 100, default: 0 }],
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: false, value: 42 },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions).toEqual({ field1: 42 })
			}
			expect(result.referencedVariableIds.size).toBe(0)
		})

		it('should handle missing option values', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal },
					{ id: 'field2', type: 'dropdown', label: 'Field 2', choices: [], default: 'opt1' },
				],
			})
			// field1 missing
			const options: ExpressionableOptionsObject = {
				field2: { isExpression: false, value: 'option1' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// field1 should be parsed from empty string
				expect(result.parsedOptions.field1).toBe('')
				expect(result.parsedOptions.field2).toBe('option1')
			}
		})

		it('should not include variables in referencedVariableIds for options in optionsToMonitorForSubscribe', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal },
					{ id: 'field2', type: 'textinput', label: 'Field 2', useVariables: useVariablesMinimal },
					{ id: 'field3', type: 'dropdown', label: 'Field 3', choices: [], default: 'opt1' },
				],
				optionsToMonitorForInvalidations: ['field2'], // Only monitor field2
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: false, value: '$(test:var1)' },
				field2: { isExpression: false, value: '$(test:var2)' },
				field3: { isExpression: false, value: 'option1' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// Both field1 and field2 should be parsed for display
				expect(result.parsedOptions).toEqual({
					field1: 'value1',
					field2: 'value2',
					field3: 'option1',
				})
			}

			// Should only reference variables from monitored fields (field2)
			expect(result.referencedVariableIds.has('test:var2')).toBe(true)
			expect(result.referencedVariableIds.has('test:var1')).toBe(false)
			expect(result.referencedVariableIds.size).toBe(1)
		})

		it('should handle textinput without useVariables', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{ id: 'field1', type: 'textinput', label: 'Field 1' }, // No useVariables
				],
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: false, value: '$(test:var1)' }, // Contains variable syntax but shouldn't be parsed
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// Should be passed through unchanged
				expect(result.parsedOptions.field1).toBe('$(test:var1)')
			}
			expect(result.referencedVariableIds.size).toBe(0)
		})

		it('should return ok: true when a number field value is clamped to min', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [{ id: 'field1', type: 'number', label: 'Field 1', min: 0, max: 100, default: 0, clampValues: true }],
				optionsSupportExpressions: true, // required so number fields go through validateInputValue
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: false, value: -10 }, // below min, should be clamped to 0
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBe(0)
			}
		})

		it('should return ok: true when a number field value is clamped to max', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [{ id: 'field1', type: 'number', label: 'Field 1', min: 0, max: 100, default: 0, clampValues: true }],
				optionsSupportExpressions: true, // required so number fields go through validateInputValue
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: false, value: 200 }, // above max, should be clamped to 100
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBe(100)
			}
		})

		it('should return ok: true when one of multiple fields has a clamped number', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{ id: 'text1', type: 'textinput', label: 'Text', useVariables: useVariablesMinimal },
					{ id: 'num1', type: 'number', label: 'Number', min: 10, max: 50, default: 10, clampValues: true },
				],
				optionsSupportExpressions: true, // required so number fields go through validateInputValue
			})
			const options: ExpressionableOptionsObject = {
				text1: { isExpression: false, value: '$(test:var1)' },
				num1: { isExpression: false, value: 999 }, // above max, should be clamped to 50
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.text1).toBe('value1')
				expect(result.parsedOptions.num1).toBe(50)
			}
		})

		it('should not clamp number field when optionsSupportExpressions is false (passthrough path)', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [{ id: 'field1', type: 'number', label: 'Field 1', min: 0, max: 100, default: 0, clampValues: true }],
				// optionsSupportExpressions: false (default) - legacy path: number fields are passed through without validation
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: false, value: 200 }, // above max, but clamping is intentionally skipped
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// In the legacy (optionsSupportExpressions: false) path, number fields are treated as
				// passthrough — validateInputValue is never called, so clampValues has no effect.
				expect(result.parsedOptions.field1).toBe(200)
			}
		})
	})

	describe('parseEntityOptions with expressions', () => {
		it('should parse expression fields when optionsSupportExpressions is true', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: false, value: '1 + $(test:num)' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBe(43)
			}
			expect(result.referencedVariableIds.has('test:num')).toBe(true)
		})

		it('should parse variable fields differently from expression fields', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'exprField',
						type: 'expression',
						label: 'Expression Field',
					},
					{
						id: 'varField',
						type: 'textinput',
						label: 'Variable Field',
						useVariables: useVariablesMinimal,
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				exprField: { isExpression: false, value: '$(test:num) * 2' },
				varField: { isExpression: false, value: 'Hello $(test:var1)' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// Expression field should compute
				expect(result.parsedOptions.exprField).toBe(84)
				// Variable field should substitute
				expect(result.parsedOptions.varField).toBe('Hello value1')
			}
		})

		it('should execute expression when isExpression is true in option value', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: true, value: '100 / 4' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBe(25)
			}
		})

		it('should handle expressions with string results', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: true, value: 'concat($(test:var1), "-suffix")' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBe('value1-suffix')
			}
			expect(result.referencedVariableIds.has('test:var1')).toBe(true)
		})

		it('should handle expressions with boolean results', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: true, value: '$(test:num) > 40' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBe(true)
			}
			expect(result.referencedVariableIds.has('test:num')).toBe(true)
		})

		it('should handle multiple expression fields with different result types', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'mathField',
						type: 'expression',
						label: 'Math Field',
					},
					{
						id: 'stringField',
						type: 'expression',
						label: 'String Field',
					},
					{
						id: 'boolField',
						type: 'expression',
						label: 'Bool Field',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				mathField: { isExpression: true, value: '$(test:num) + 8' },
				stringField: { isExpression: true, value: 'concat($(test:var1), "-suffix")' },
				boolField: { isExpression: true, value: '$(test:num) == 42' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.mathField).toBe(50)
				expect(result.parsedOptions.stringField).toBe('value1-suffix')
				expect(result.parsedOptions.boolField).toBe(true)
			}
			expect(result.referencedVariableIds.has('test:num')).toBe(true)
			expect(result.referencedVariableIds.has('test:var1')).toBe(true)
		})

		it('should track variables from expressions in monitored fields', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'monitoredExpr',
						type: 'expression',
						label: 'Monitored Expression',
					},
					{
						id: 'unmonitoredExpr',
						type: 'expression',
						label: 'Unmonitored Expression',
					},
				],
				optionsToMonitorForInvalidations: ['monitoredExpr'],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				monitoredExpr: { isExpression: true, value: 'concat($(test:var1), " monitored")' },
				unmonitoredExpr: { isExpression: true, value: 'concat($(test:var2), " unmonitored")' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.monitoredExpr).toBe('value1 monitored')
				expect(result.parsedOptions.unmonitoredExpr).toBe('value2 unmonitored')
			}
			// Only monitored field variables should be tracked
			expect(result.referencedVariableIds.has('test:var1')).toBe(true)
			expect(result.referencedVariableIds.has('test:var2')).toBe(false)
		})

		it('should handle expression that returns undefined/null', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: true, value: 'undefined' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBeUndefined()
			}
		})

		it('should handle expression with missing variables', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: true, value: 'concat($(unknown:var), " test")' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// Should substitute '' for unknown variable, then concatenate
				expect(result.parsedOptions.field1).toBe(' test')
			}
			expect(result.referencedVariableIds.has('unknown:var')).toBe(true)
		})

		it('should handle mixed expression and non-expression options', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'exprField',
						type: 'expression',
						label: 'Expression Field',
					},
					{
						id: 'plainField',
						type: 'textinput',
						label: 'Plain Field',
					},
					{
						id: 'varField',
						type: 'textinput',
						label: 'Variable Field',
						useVariables: useVariablesMinimal,
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				exprField: { isExpression: true, value: '$(test:num) * 3' },
				plainField: { isExpression: false, value: '$(test:var1) literal' },
				varField: { isExpression: false, value: '$(test:var1) parsed' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.exprField).toBe(126)
				expect(result.parsedOptions.plainField).toBe('$(test:var1) literal')
				expect(result.parsedOptions.varField).toBe('value1 parsed')
			}
			expect(result.referencedVariableIds.has('test:num')).toBe(true)
			expect(result.referencedVariableIds.has('test:var1')).toBe(true)
		})

		it('should handle complex expressions with multiple variables', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				field1: {
					isExpression: true,
					value: 'concat($(test:var1), " ", $(test:var2), " ", $(test:num))',
				},
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBe('value1 value2 42')
			}
			expect(result.referencedVariableIds.has('test:var1')).toBe(true)
			expect(result.referencedVariableIds.has('test:var2')).toBe(true)
			expect(result.referencedVariableIds.has('test:num')).toBe(true)
		})

		it('should not evaluate expression when optionsSupportExpressions is false', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				// optionsSupportExpressions: false (default) - module doesn't support expressions
			})
			const options: ExpressionableOptionsObject = {
				field1: { isExpression: true, value: '1 + 1' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// Should NOT evaluate when module doesn't support expressions
				expect(result.parsedOptions.field1).toBe('1 + 1')
			}
		})

		it('should handle non-expression value in expression field', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsSupportExpressions: true,
			})
			const options: ExpressionableOptionsObject = {
				// isExpression is false, but field definition supports expressions
				field1: { isExpression: false, value: '1 + 1' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// Should still evaluate because field definition has isExpression: true
				expect(result.parsedOptions.field1).toBe(2)
			}
		})
	})

	describe('parseEntityOption', () => {
		const parseExpressionOrVariables: VisitEntityOptionValueOptions = {
			allowExpression: true,
			parseVariables: true,
		}
		const parseExpressionOnly: VisitEntityOptionValueOptions = {
			allowExpression: true,
			parseVariables: false,
		}
		const parseVariablesOnly: VisitEntityOptionValueOptions = {
			allowExpression: false,
			parseVariables: true,
		}
		const parseNothing: VisitEntityOptionValueOptions = {
			allowExpression: false,
			parseVariables: false,
		}
		const parseForceExpression: VisitEntityOptionValueOptions = {
			allowExpression: false,
			parseVariables: false,
			forceExpression: true,
		}

		describe('with undefined/null values', () => {
			it('should handle undefined value', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(undefined, parseExpressionOrVariables)

				expect(result.value).toBeUndefined()
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should handle undefined with different options', () => {
				const parser = createParser()

				expect(parser.parseEntityOption(undefined, parseExpressionOnly).value).toBeUndefined()
				expect(parser.parseEntityOption(undefined, parseVariablesOnly).value).toBeUndefined()
				expect(parser.parseEntityOption(undefined, parseNothing).value).toBeUndefined()
				expect(parser.parseEntityOption(undefined, parseForceExpression).value).toBeUndefined()
			})
		})

		describe('with exprExpr() values', () => {
			it('should evaluate expression when allowExpression is true', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprExpr('$(test:num) + 1'), parseExpressionOrVariables)

				expect(result.value).toBe(43)
				expect(result.referencedVariableIds.has('test:num')).toBe(true)
			})

			it('should evaluate expression when only allowExpression is true', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprExpr('10 * 2'), parseExpressionOnly)

				expect(result.value).toBe(20)
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should treat as string when allowExpression is false', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprExpr('10 * 2'), parseVariablesOnly)

				expect(result.value).toBe('10 * 2')
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should parse variables in expression result', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprExpr('concat("Value: ", $(test:var1))'), parseExpressionOrVariables)

				expect(result.value).toBe('Value: value1')
				expect(result.referencedVariableIds.has('test:var1')).toBe(true)
			})
		})

		describe('with exprVal() values', () => {
			it('should parse variables when parseVariables is true', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('Hello $(test:var1)'), parseExpressionOrVariables)

				expect(result.value).toBe('Hello value1')
				expect(result.referencedVariableIds.has('test:var1')).toBe(true)
			})

			it('should parse variables when only parseVariables is true', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('$(test:var1)-$(test:var2)'), parseVariablesOnly)

				expect(result.value).toBe('value1-value2')
				expect(result.referencedVariableIds.has('test:var1')).toBe(true)
				expect(result.referencedVariableIds.has('test:var2')).toBe(true)
			})

			it('should pass through unchanged when parseVariables is false', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('$(test:var1)'), parseExpressionOnly)

				expect(result.value).toBe('$(test:var1)')
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should pass through unchanged when nothing is enabled', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('$(test:var1)'), parseNothing)

				expect(result.value).toBe('$(test:var1)')
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should handle plain text without variables', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('plain text'), parseVariablesOnly)

				expect(result.value).toBe('plain text')
				expect(result.referencedVariableIds.size).toBe(0)
			})
		})

		describe('with ExpressionOrValue objects (isExpression: true)', () => {
			it('should evaluate when allowExpression is true', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(
					{ value: '$(test:num) + 10', isExpression: true },
					parseExpressionOrVariables
				)

				expect(result.value).toBe(52)
				expect(result.referencedVariableIds.has('test:num')).toBe(true)
			})

			it('should evaluate when only allowExpression is true', () => {
				const parser = createParser()
				const result = parser.parseEntityOption({ value: '5 * 5', isExpression: true }, parseExpressionOnly)

				expect(result.value).toBe(25)
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should treat as string when allowExpression is false', () => {
				const parser = createParser()
				const result = parser.parseEntityOption({ value: '5 * 5', isExpression: true }, parseVariablesOnly)

				expect(result.value).toBe('5 * 5')
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should evaluate string expressions', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(
					{ value: 'concat($(test:var1), "-suffix")', isExpression: true },
					parseExpressionOrVariables
				)

				expect(result.value).toBe('value1-suffix')
				expect(result.referencedVariableIds.has('test:var1')).toBe(true)
			})

			it('should evaluate boolean expressions', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(
					{ value: '$(test:num) > 40', isExpression: true },
					parseExpressionOrVariables
				)

				expect(result.value).toBe(true)
				expect(result.referencedVariableIds.has('test:num')).toBe(true)
			})
		})

		describe('with ExpressionOrValue objects (isExpression: false)', () => {
			it('should parse variables when parseVariables is true', () => {
				const parser = createParser()
				const result = parser.parseEntityOption({ value: '$(test:var1)', isExpression: false }, parseVariablesOnly)

				expect(result.value).toBe('value1')
				expect(result.referencedVariableIds.has('test:var1')).toBe(true)
			})

			it('should parse variables with both options enabled', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(
					{ value: 'Prefix $(test:var2)', isExpression: false },
					parseExpressionOrVariables
				)

				expect(result.value).toBe('Prefix value2')
				expect(result.referencedVariableIds.has('test:var2')).toBe(true)
			})

			it('should pass through when parseVariables is false', () => {
				const parser = createParser()
				const result = parser.parseEntityOption({ value: '$(test:var1)', isExpression: false }, parseExpressionOnly)

				expect(result.value).toBe('$(test:var1)')
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should pass through when nothing is enabled', () => {
				const parser = createParser()
				const result = parser.parseEntityOption({ value: '$(test:var1)', isExpression: false }, parseNothing)

				expect(result.value).toBe('$(test:var1)')
				expect(result.referencedVariableIds.size).toBe(0)
			})
		})

		describe('with forceExpression option', () => {
			it('should force evaluation even when isExpression is false', () => {
				const parser = createParser()
				const result = parser.parseEntityOption({ value: '$(test:num) + 1', isExpression: false }, parseForceExpression)

				expect(result.value).toBe(43)
				expect(result.referencedVariableIds.has('test:num')).toBe(true)
			})

			it('should force evaluation with exprVal', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('$(test:num) * 2'), parseForceExpression)

				expect(result.value).toBe(84)
				expect(result.referencedVariableIds.has('test:num')).toBe(true)
			})

			it('should force evaluation with complex expressions', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('$(test:num) > 30 ? "high" : "low"'), parseForceExpression)

				expect(result.value).toBe('high')
				expect(result.referencedVariableIds.has('test:num')).toBe(true)
			})
		})

		describe('with plain (non-wrapped) values', () => {
			it('should handle plain strings', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('plain string'), parseExpressionOrVariables)

				expect(result.value).toBe('plain string')
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should handle number values as strings', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal(42), parseExpressionOrVariables)

				expect(result.value).toBe('42')
				expect(result.referencedVariableIds.size).toBe(0)
			})

			it('should handle boolean values', () => {
				const parser = createParser()
				const result1 = parser.parseEntityOption(exprVal(true), parseExpressionOrVariables)
				const result2 = parser.parseEntityOption(exprVal(false), parseExpressionOrVariables)

				expect(result1.value).toBe('true')
				expect(result2.value).toBe('false')
				expect(result1.referencedVariableIds.size).toBe(0)
				expect(result2.referencedVariableIds.size).toBe(0)
			})
		})

		describe('error handling', () => {
			it('should throw error on invalid expression syntax', () => {
				const parser = createParser()

				expect(() =>
					parser.parseEntityOption({ isExpression: true, value: '"unclosed string' }, parseExpressionOrVariables)
				).toThrow()
			})

			it('should throw error on invalid expression with unmatched parens', () => {
				const parser = createParser()

				expect(() =>
					parser.parseEntityOption({ isExpression: true, value: '(1 + 2' }, parseExpressionOrVariables)
				).toThrow()
			})

			it('should handle invalid syntax gracefully when not in expression mode', () => {
				const parser = createParser()

				// Invalid expression syntax that would fail if evaluated, but should work when treated as string
				const result = parser.parseEntityOption(exprVal('1 + + 2'), parseVariablesOnly)
				expect(result.value).toBe('1 + + 2')
			})
		})

		describe('variable tracking', () => {
			it('should track multiple variables in expressions', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(
					exprExpr('concat($(test:var1), $(test:var2), $(another:var))'),
					parseExpressionOrVariables
				)

				expect(result.referencedVariableIds.has('test:var1')).toBe(true)
				expect(result.referencedVariableIds.has('test:var2')).toBe(true)
				expect(result.referencedVariableIds.has('another:var')).toBe(true)
				expect(result.referencedVariableIds.size).toBe(3)
			})

			it('should track variables in variable fields', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('$(test:var1) and $(another:var)'), parseVariablesOnly)

				expect(result.referencedVariableIds.has('test:var1')).toBe(true)
				expect(result.referencedVariableIds.has('another:var')).toBe(true)
				expect(result.referencedVariableIds.size).toBe(2)
			})

			it('should track unknown variables', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('$(unknown:var)'), parseVariablesOnly)

				expect(result.value).toBe('$NA')
				expect(result.referencedVariableIds.has('unknown:var')).toBe(true)
			})

			it('should not track variables when parsing is disabled', () => {
				const parser = createParser()
				const result = parser.parseEntityOption(exprVal('$(test:var1)'), parseNothing)

				expect(result.value).toBe('$(test:var1)')
				expect(result.referencedVariableIds.size).toBe(0)
			})
		})
	})

	describe('thisValues and overrideValues', () => {
		it('should use thisValues when available', () => {
			const thisValues: VariablesCache = new Map([['custom:val', 'from-this']])

			const parser = createParser({}, thisValues)
			const result = parser.parseVariables('$(custom:val)')

			expect(result.text).toBe('from-this')
			expect(result.variableIds).toContain('custom:val')
		})

		it('should prefer thisValues over rawVariables', () => {
			const thisValues: VariablesCache = new Map([['test:var1', 'overridden']])

			const parser = createParser(defaultVariables, thisValues)
			const result = parser.parseVariables('$(test:var1)')

			expect(result.text).toBe('overridden')
		})
	})

	describe('edge cases', () => {
		it('should handle non-string values in options converted to string', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal }],
			})
			// Pass a number where a string is expected
			const options: ExpressionableOptionsObject = { field1: { isExpression: false, value: 123 } }

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// Should convert to string
				expect(result.parsedOptions.field1).toBe('123')
			}
		})

		it('should handle nested variable references', () => {
			const variables: VariableValueData = {
				test: {
					name: 'var1',
					var1: 'final-value',
				},
			}
			const parser = createParser(variables)
			const result = parser.parseVariables('$(test:$(test:name))')

			expect(result.text).toBe('final-value')
			expect(result.variableIds).toContain('test:name')
			expect(result.variableIds).toContain('test:var1')
		})

		it('should handle multiple fields with some having variables', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [
					{ id: 'text1', type: 'textinput', label: 'Text 1', useVariables: useVariablesMinimal },
					{ id: 'num1', type: 'number', label: 'Number 1', min: 0, max: 100, default: 0 },
					{ id: 'text2', type: 'textinput', label: 'Text 2', useVariables: useVariablesMinimal },
					{ id: 'check1', type: 'checkbox', label: 'Checkbox 1', default: false },
				],
			})
			const options: ExpressionableOptionsObject = {
				text1: { isExpression: false, value: '$(test:var1)' },
				num1: { isExpression: false, value: 50 },
				text2: { isExpression: false, value: '$(test:var2) and $(another:var)' },
				check1: { isExpression: false, value: true },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions).toEqual({
					text1: 'value1',
					num1: 50,
					text2: 'value2 and another-value',
					check1: true,
				})
			}
			expect(result.referencedVariableIds.has('test:var1')).toBe(true)
			expect(result.referencedVariableIds.has('test:var2')).toBe(true)
			expect(result.referencedVariableIds.has('another:var')).toBe(true)
		})

		it('should handle empty options object', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal }],
			})
			const options: ExpressionableOptionsObject = {}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.field1).toBe('')
			}
			expect(result.referencedVariableIds.size).toBe(0)
		})

		it('should handle empty entity definition options', () => {
			const parser = createParser()
			const entityDefinition = createDefinition({
				options: [],
			})
			const options: ExpressionableOptionsObject = {
				anyField: { isExpression: false, value: 'value' },
			}

			const result = parser.parseEntityOptions(entityDefinition, options)

			expect(result.ok).toBe(true)
			if (result.ok) {
				// No options defined, so nothing to parse
				expect(result.parsedOptions).toEqual({})
			}
			expect(result.referencedVariableIds.size).toBe(0)
		})
	})

	describe('createChildParser', () => {
		it('child inherits raw variable values from parent', () => {
			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				defaultVariables,
				new Map(),
				null,
				null
			)
			const child = parser.createChildParser({})

			const result = child.parseVariables('$(test:var1)')
			expect(result.text).toBe('value1')
			expect(result.variableIds).toContain('test:var1')
		})

		it('child inherits thisValues from parent', () => {
			const thisValues: VariablesCache = new Map([['custom:val', 'from-this']])
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, thisValues, null, null)
			const child = parser.createChildParser({})

			const result = child.parseVariables('$(custom:val)')
			expect(result.text).toBe('from-this')
		})

		it('child inherits parent override values', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, {
				'override:val': 'parent-override',
			})
			const child = parser.createChildParser({})

			const result = child.parseVariables('$(override:val)')
			expect(result.text).toBe('parent-override')
		})

		it('child new overrides take precedence over parent overrides', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, {
				'override:val': 'parent-override',
			})
			const child = parser.createChildParser({ 'override:val': 'child-override' })

			const result = child.parseVariables('$(override:val)')
			expect(result.text).toBe('child-override')
		})

		it('non-overlapping parent overrides remain accessible in child', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, {
				'override:parent-only': 'parent-value',
			})
			const child = parser.createChildParser({ 'override:child-only': 'child-value' })

			expect(child.parseVariables('$(override:parent-only)').text).toBe('parent-value')
			expect(child.parseVariables('$(override:child-only)').text).toBe('child-value')
		})

		it('child overrides do not affect parent', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, null)
			const child = parser.createChildParser({ 'override:new': 'child-value' })

			expect(parser.parseVariables('$(override:new)').text).toBe('$NA')
			expect(child.parseVariables('$(override:new)').text).toBe('child-value')
		})

		it('child inherits local variables from parent', () => {
			const mockEntity = {
				localVariableName: 'local:myvar',
				feedbackValue: 'local-value',
				type: EntityModelType.Feedback,
				connectionId: 'non-internal',
				definitionId: 'some-def',
			} as unknown as ControlEntityInstance
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), [mockEntity], null)
			const child = parser.createChildParser({})

			const result = child.parseVariables('$(local:myvar)')
			expect(result.text).toBe('local-value')
		})

		it('inherited local variables take precedence over override values with the same key', () => {
			// localValues are checked before overrideVariableValues in the lookup chain
			const mockEntity = {
				localVariableName: 'local:myvar',
				feedbackValue: 'local-value',
				type: EntityModelType.Feedback,
				connectionId: 'non-internal',
				definitionId: 'some-def',
			} as unknown as ControlEntityInstance
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), [mockEntity], null)
			const child = parser.createChildParser({ 'local:myvar': 'override-value' })

			// localValues (inherited) take priority over overrideVariableValues
			const result = child.parseVariables('$(local:myvar)')
			expect(result.text).toBe('local-value')
		})

		it('child executeExpression works with inherited raw variables', () => {
			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				defaultVariables,
				new Map(),
				null,
				null
			)
			const child = parser.createChildParser({})

			const result = child.executeExpression('$(test:num) + 1', undefined)
			expect(result.ok).toBe(true)
			if (result.ok) expect(result.value).toBe(43)
		})

		it('child executeExpression uses child override values', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, null)
			const child = parser.createChildParser({ 'custom:num': 100 })

			const result = child.executeExpression('$(custom:num) * 2', undefined)
			expect(result.ok).toBe(true)
			if (result.ok) expect(result.value).toBe(200)
		})

		it('child override shadows parent raw variable', () => {
			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				defaultVariables,
				new Map(),
				null,
				null
			)
			const child = parser.createChildParser({ 'test:var1': 'shadowed' })

			expect(child.parseVariables('$(test:var1)').text).toBe('shadowed')
			expect(parser.parseVariables('$(test:var1)').text).toBe('value1')
		})

		// context-variable injection (this:current / target:*) used by deferred-parse actions
		it('injects $(this:current) via parseVariables', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, null)
			const child = parser.createChildParser({ 'this:current': '42' })
			expect(child.parseVariables('$(this:current)').text).toBe('42')
		})

		it('injects $(this:current) in an expression', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, null)
			const child = parser.createChildParser({ 'this:current': 10 })
			const result = child.executeExpression('$(this:current) + 1', undefined)
			expect(result.ok).toBe(true)
			if (result.ok) expect(result.value).toBe(11)
		})

		it('injects $(target:foo) via parseVariables', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, null)
			const child = parser.createChildParser({ 'this:current': 0, 'target:counter': 5 })
			expect(child.parseVariables('count=$(target:counter)').text).toBe('count=5')
		})
	})

	describe('createIsolatedChildParser', () => {
		it('resolves the injected override values', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, null)
			const child = parser.createIsolatedChildParser({ 'options:label': 'injected' })

			expect(child.parseVariables('$(options:label)').text).toBe('injected')
			const result = child.executeExpression('$(options:label)', undefined)
			expect(result.ok).toBe(true)
			if (result.ok) expect(result.value).toBe('injected')
		})

		it('does NOT inherit raw variable values from parent', () => {
			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				defaultVariables,
				new Map(),
				null,
				null
			)
			const child = parser.createIsolatedChildParser({})

			expect(child.parseVariables('$(test:var1)').text).toBe('$NA')
		})

		it('does NOT inherit thisValues from parent', () => {
			const thisValues: VariablesCache = new Map([['custom:val', 'from-this']])
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, thisValues, null, null)
			const child = parser.createIsolatedChildParser({})

			expect(child.parseVariables('$(custom:val)').text).toBe('$NA')
		})

		it('does NOT inherit parent override values', () => {
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), null, {
				'override:val': 'parent-override',
			})
			const child = parser.createIsolatedChildParser({})

			expect(child.parseVariables('$(override:val)').text).toBe('$NA')
		})

		it('does NOT inherit local variables from parent', () => {
			const mockEntity = {
				localVariableName: 'local:myvar',
				feedbackValue: 'local-value',
				type: EntityModelType.Feedback,
				connectionId: 'non-internal',
				definitionId: 'some-def',
			} as unknown as ControlEntityInstance
			const parser = new VariablesAndExpressionParser(mockUserConfig, null as any, {}, new Map(), [mockEntity], null)
			const child = parser.createIsolatedChildParser({})

			expect(child.parseVariables('$(local:myvar)').text).toBe('$NA')
		})
	})

	describe('deferParsing field passthrough', () => {
		function makeDeferredDefinition(): ClientEntityDefinition {
			return {
				entityType: EntityModelType.Action,
				label: 'Test',
				sortKey: null,
				description: undefined,
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				actionHasResult: false,
				feedbackAffectedProperties: undefined,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
				options: [
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						deferParsing: true,
						allowInvalidValues: true,
						disableSanitisation: true,
					},
				],
			}
		}

		it('passes through a variable-string value without substitution', () => {
			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				{ test: { foo: 'hello' } },
				new Map(),
				null,
				null
			)
			const result = parser.parseEntityOptions(makeDeferredDefinition(), { value: exprVal('$(test:foo) world') })
			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.parsedOptions.value).toBe('$(test:foo) world')
				expect(result.referencedVariableIds.size).toBe(0)
			}
		})

		it('passes through an expression string without evaluation', () => {
			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				{ test: { num: 10 } },
				new Map(),
				null,
				null
			)
			const result = parser.parseEntityOptions(makeDeferredDefinition(), { value: exprExpr('$(test:num) + 5') })
			expect(result.ok).toBe(true)
			if (result.ok) expect(result.parsedOptions.value).toBe('$(test:num) + 5')
		})

		it('ignores deferParsing on the legacy (optionsSupportExpressions: false) path', () => {
			const definition = createDefinition({
				// optionsSupportExpressions: false (default) — legacy path only checks useVariables
				options: [
					{
						type: 'textinput',
						label: 'Value',
						id: 'value',
						default: '',
						deferParsing: true,
						useVariables: useVariablesMinimal,
						allowInvalidValues: true,
						disableSanitisation: true,
					},
				],
			})

			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				{ test: { foo: 'hello' } },
				new Map(),
				null,
				null
			)
			const result = parser.parseEntityOptions(definition, { value: exprVal('$(test:foo) world') })

			expect(result.ok).toBe(true)
			if (result.ok) {
				// Variables are still substituted — deferParsing has no effect on the legacy path
				expect(result.parsedOptions.value).toBe('hello world')
				expect(result.referencedVariableIds.has('test:foo')).toBe(true)
			}
		})
	})

	describe('clockSensitive propagation', () => {
		it('executeExpression reports clockSensitive only when oscillate is used', () => {
			const parser = createParser()
			expect(parser.executeExpression('oscillate(1000)', undefined).clockSensitive).toBe(true)
			expect(parser.executeExpression('1 + 2', undefined).clockSensitive).toBe(false)
		})

		it('parseEntityOption passes through clockSensitive from an expression', () => {
			const parser = createParser()
			const sensitive = parser.parseEntityOption(exprExpr('oscillate(1000)'), {
				allowExpression: true,
				parseVariables: false,
			})
			expect(sensitive.clockSensitive).toBe(true)

			const plain = parser.parseEntityOption(exprExpr('1 + 2'), { allowExpression: true, parseVariables: false })
			expect(plain.clockSensitive).toBe(false)
		})

		it('parseEntityOption is never clockSensitive on the variable-interpolation or passthrough paths', () => {
			const parser = createParser()
			// A variable string is parsed by parseVariables, which cannot be clock-sensitive
			expect(
				parser.parseEntityOption(exprVal('$(test:var1)'), { allowExpression: false, parseVariables: true })
					.clockSensitive
			).toBe(false)
			// A passthrough (nothing enabled) value is never clock-sensitive
			expect(
				parser.parseEntityOption(exprVal('$(test:var1)'), { allowExpression: false, parseVariables: false })
					.clockSensitive
			).toBe(false)
			// A missing value is never clock-sensitive
			expect(
				parser.parseEntityOption(undefined, { allowExpression: true, parseVariables: true }).clockSensitive
			).toBe(false)
		})

		it('parseEntityOptions ORs clockSensitive across all fields', () => {
			const parser = createParser()
			const definition = createDefinition({
				options: [
					{ id: 'plain', type: 'expression', label: 'Plain' },
					{ id: 'osc', type: 'expression', label: 'Oscillating' },
				],
				optionsSupportExpressions: true,
			})
			const result = parser.parseEntityOptions(definition, {
				plain: { isExpression: true, value: '1 + 2' },
				osc: { isExpression: true, value: 'oscillate(1000)' },
			})
			expect(result.ok).toBe(true)
			expect(result.clockSensitive).toBe(true)
		})

		it('parseEntityOptions reports clockSensitive false when no field uses oscillate', () => {
			const parser = createParser()
			const definition = createDefinition({
				options: [
					{ id: 'a', type: 'expression', label: 'A' },
					{ id: 'b', type: 'textinput', label: 'B', useVariables: useVariablesMinimal },
				],
				optionsSupportExpressions: true,
			})
			const result = parser.parseEntityOptions(definition, {
				a: { isExpression: true, value: '1 + 2' },
				b: { isExpression: false, value: '$(test:var1)' },
			})
			expect(result.ok).toBe(true)
			expect(result.clockSensitive).toBe(false)
		})

		it('an error result still carries the aggregated clockSensitive flag', () => {
			const parser = createParser()
			const definition = createDefinition({
				options: [
					{ id: 'osc', type: 'expression', label: 'Oscillating' },
					// Out of range with no clamping/allowInvalidValues -> validation error -> ok:false
					{ id: 'num', type: 'number', label: 'Number', min: 0, max: 100, default: 0 },
				],
				optionsSupportExpressions: true,
			})
			const result = parser.parseEntityOptions(definition, {
				osc: { isExpression: true, value: 'oscillate(1000)' },
				num: { isExpression: false, value: 200 },
			})
			expect(result.ok).toBe(false)
			expect(result.clockSensitive).toBe(true)
		})

		it('rejects oscillate when the parser disallows clock-sensitive expressions', () => {
			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				defaultVariables,
				new Map(),
				null,
				null,
				false // allowClockSensitive
			)
			const result = parser.executeExpression('oscillate(1000)', undefined)
			expect(result.ok).toBe(false)
			expect(result.clockSensitive).toBe(false)
		})

		it('child parsers inherit the allowClockSensitive setting', () => {
			const parser = new VariablesAndExpressionParser(
				mockUserConfig,
				null as any,
				defaultVariables,
				new Map(),
				null,
				null,
				false // allowClockSensitive
			)
			const child = parser.createChildParser({})
			expect(child.executeExpression('oscillate(1000)', undefined).ok).toBe(false)
		})
	})
})
