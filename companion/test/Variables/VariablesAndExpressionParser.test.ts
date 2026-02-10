import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ParseFieldOptions, VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	CompanionFieldVariablesSupport,
	exprExpr,
	exprVal,
	type ExpressionableOptionsObject,
} from '@companion-app/shared/Model/Options.js'
import type { VariableValueData, VariablesCache } from '../../lib/Variables/Util.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

const useVariablesMinimal = CompanionFieldVariablesSupport.Basic

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
		return new VariablesAndExpressionParser(null as any, variables, thisValues, localValues, overrideValues)
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal },
					{ id: 'field2', type: 'dropdown', label: 'Field 2', choices: [], default: 'opt1' },
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [{ id: 'field1', type: 'number', label: 'Field 1', min: 0, max: 100, default: 0 }],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal },
					{ id: 'field2', type: 'dropdown', label: 'Field 2', choices: [], default: 'opt1' },
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal },
					{ id: 'field2', type: 'textinput', label: 'Field 2', useVariables: useVariablesMinimal },
					{ id: 'field3', type: 'dropdown', label: 'Field 3', choices: [], default: 'opt1' },
				],
				optionsToMonitorForInvalidations: ['field2'], // Only monitor field2
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{ id: 'field1', type: 'textinput', label: 'Field 1' }, // No useVariables
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
	})

	describe('parseEntityOptions with expressions', () => {
		it('should parse expression fields when optionsSupportExpressions is true', () => {
			const parser = createParser()
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
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
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
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
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
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
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
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
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false, // Module doesn't support expressions
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
					},
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: true,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
		const parseExpressionOrVariables: ParseFieldOptions = {
			allowExpression: true,
			parseVariables: true,
		}
		const parseExpressionOnly: ParseFieldOptions = {
			allowExpression: true,
			parseVariables: false,
		}
		const parseVariablesOnly: ParseFieldOptions = {
			allowExpression: false,
			parseVariables: true,
		}
		const parseNothing: ParseFieldOptions = {
			allowExpression: false,
			parseVariables: false,
		}
		const parseForceExpression: ParseFieldOptions = {
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
			const thisValues: VariablesCache = new Map([['$(custom:val)', 'from-this']])

			const parser = createParser({}, thisValues)
			const result = parser.parseVariables('$(custom:val)')

			expect(result.text).toBe('from-this')
			expect(result.variableIds).toContain('custom:val')
		})

		it('should prefer thisValues over rawVariables', () => {
			const thisValues: VariablesCache = new Map([['$(test:var1)', 'overridden']])

			const parser = createParser(defaultVariables, thisValues)
			const result = parser.parseVariables('$(test:var1)')

			expect(result.text).toBe('overridden')
		})
	})

	describe('edge cases', () => {
		it('should handle non-string values in options converted to string', () => {
			const parser = createParser()
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal }],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [
					{ id: 'text1', type: 'textinput', label: 'Text 1', useVariables: useVariablesMinimal },
					{ id: 'num1', type: 'number', label: 'Number 1', min: 0, max: 100, default: 0 },
					{ id: 'text2', type: 'textinput', label: 'Text 2', useVariables: useVariablesMinimal },
					{ id: 'check1', type: 'checkbox', label: 'Checkbox 1', default: false },
				],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [{ id: 'field1', type: 'textinput', label: 'Field 1', useVariables: useVariablesMinimal }],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
			const entityDefinition: ClientEntityDefinition = {
				entityType: EntityModelType.Action,
				label: 'Test',
				description: undefined,
				options: [],
				optionsToMonitorForInvalidations: null,
				feedbackType: null,
				feedbackStyle: undefined,
				hasLifecycleFunctions: true,
				hasLearn: false,
				learnTimeout: undefined,
				showInvert: false,
				optionsSupportExpressions: false,
				showButtonPreview: false,
				supportsChildGroups: [],
			}
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
})
