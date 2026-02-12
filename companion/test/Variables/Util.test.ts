import { describe, expect, it } from 'vitest'
import { visitEntityOptionsForVariables } from '../../lib/Variables/Util.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	type SomeCompanionInputField,
	type ExpressionableOptionsObject,
	CompanionFieldVariablesSupport,
	exprVal,
} from '@companion-app/shared/Model/Options.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

function createDefinition(
	partial: Pick<ClientEntityDefinition, 'label' | 'options'> & Partial<ClientEntityDefinition>
): ClientEntityDefinition {
	return {
		entityType: EntityModelType.Action,
		description: '',
		optionsToMonitorForInvalidations: [],
		feedbackType: undefined,
		feedbackStyle: undefined,
		hasLifecycleFunctions: false,
		hasLearn: false,
		learnTimeout: undefined,
		showInvert: false,
		optionsSupportExpressions: false,
		showButtonPreview: false,
		supportsChildGroups: [],
		...partial,
	}
}

describe('visitEntityOptionsForVariables', () => {
	describe('legacy mode (optionsSupportExpressions: false)', () => {
		it('should process textinput with useVariables', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: false,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
						useVariables: CompanionFieldVariablesSupport.Basic,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('test value'),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(1)
			expect(results[0].field.id).toBe('field1')
			expect(results[0].fieldType).toEqual({
				allowExpression: false,
				parseVariables: true,
			})
		})

		it('should pass through textinput without useVariables', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: false,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('test value'),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(1)
			expect(results[0].field.id).toBe('field1')
			expect(results[0].fieldType).toBe(null)
		})

		it('should pass through non-textinput fields with null', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: false,
				options: [
					{
						id: 'field1',
						type: 'dropdown',
						label: 'Field 1',
						choices: [],
						default: '',
					},
					{
						id: 'field2',
						type: 'number',
						label: 'Field 2',
						min: 0,
						max: 100,
						default: 0,
					},
					{
						id: 'field3',
						type: 'checkbox',
						label: 'Field 3',
						default: false,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				field2: exprVal(50),
				field3: exprVal(true),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(3)
			expect(results[0].fieldType).toBe(null)
			expect(results[1].fieldType).toBe(null)
			expect(results[2].fieldType).toBe(null)
		})

		it('should handle mixed fields', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: false,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
						useVariables: CompanionFieldVariablesSupport.Basic,
					},
					{
						id: 'field2',
						type: 'dropdown',
						label: 'Field 2',
						choices: [],
						default: '',
					},
					{
						id: 'field3',
						type: 'textinput',
						label: 'Field 3',
						default: '',
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				field2: exprVal('value2'),
				field3: exprVal('value3'),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(3)
			expect(results[0].fieldType).toEqual({
				allowExpression: false,
				parseVariables: true,
			})
			expect(results[1].fieldType).toBe(null)
			expect(results[2].fieldType).toBe(null)
		})
	})

	describe('modern mode (optionsSupportExpressions: true)', () => {
		it('should set allowExpression for all fields by default', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
					},
					{
						id: 'field2',
						type: 'dropdown',
						label: 'Field 2',
						choices: [],
						default: '',
					},
					{
						id: 'field3',
						type: 'number',
						label: 'Field 3',
						min: 0,
						max: 100,
						default: 0,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				field2: exprVal('value2'),
				field3: exprVal(50),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(3)
			expect(results[0].fieldType).toEqual({
				allowExpression: true,
				parseVariables: false,
			})
			expect(results[1].fieldType).toEqual({
				allowExpression: true,
				parseVariables: false,
			})
			expect(results[2].fieldType).toEqual({
				allowExpression: true,
				parseVariables: false,
			})
		})

		it('should set parseVariables for textinput with useVariables', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
						useVariables: CompanionFieldVariablesSupport.Basic,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('test value'),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(1)
			expect(results[0].fieldType).toEqual({
				allowExpression: true,
				parseVariables: true,
			})
		})

		it('should set forceExpression for expression type fields', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'expression',
						label: 'Field 1',
						default: '',
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: { value: '1 + 1', isExpression: true },
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(1)
			expect(results[0].fieldType).toEqual({
				allowExpression: true,
				parseVariables: false,
				forceExpression: true,
			})
		})

		it('should respect disableAutoExpression flag', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
						disableAutoExpression: true,
					},
					{
						id: 'field2',
						type: 'dropdown',
						label: 'Field 2',
						choices: [],
						default: '',
						disableAutoExpression: true,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				field2: exprVal('value2'),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(2)
			expect(results[0].fieldType).toEqual({
				allowExpression: false,
				parseVariables: false,
			})
			expect(results[1].fieldType).toEqual({
				allowExpression: false,
				parseVariables: false,
			})
		})

		it('should handle textinput with useVariables and disableAutoExpression', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
						useVariables: CompanionFieldVariablesSupport.Basic,
						disableAutoExpression: true,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('test value'),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(1)
			expect(results[0].fieldType).toEqual({
				allowExpression: false,
				parseVariables: true,
			})
		})

		it('should handle all field combinations in modern mode', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
						useVariables: CompanionFieldVariablesSupport.Basic,
					},
					{
						id: 'field2',
						type: 'textinput',
						label: 'Field 2',
						default: '',
					},
					{
						id: 'field3',
						type: 'expression',
						label: 'Field 3',
						default: '',
					},
					{
						id: 'field4',
						type: 'dropdown',
						label: 'Field 4',
						choices: [],
						default: '',
					},
					{
						id: 'field5',
						type: 'textinput',
						label: 'Field 5',
						default: '',
						disableAutoExpression: true,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				field2: exprVal('value2'),
				field3: { value: '1 + 1', isExpression: true },
				field4: exprVal('value4'),
				field5: exprVal('value5'),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(5)
			expect(results[0].fieldType).toEqual({
				allowExpression: true,
				parseVariables: true,
			})
			expect(results[1].fieldType).toEqual({
				allowExpression: true,
				parseVariables: false,
			})
			expect(results[2].fieldType).toEqual({
				allowExpression: true,
				parseVariables: false,
				forceExpression: true,
			})
			expect(results[3].fieldType).toEqual({
				allowExpression: true,
				parseVariables: false,
			})
			expect(results[4].fieldType).toEqual({
				allowExpression: false,
				parseVariables: false,
			})
		})
	})

	describe('visitor function behavior', () => {
		it('should call visitor for each field with correct parameters', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
					},
					{
						id: 'field2',
						type: 'number',
						label: 'Field 2',
						min: 0,
						max: 100,
						default: 0,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				field2: exprVal(50),
			}

			const visitorCalls: Array<{ field: SomeCompanionInputField; value: any; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				visitorCalls.push({ field, value, fieldType })
				return `transformed_${value}`
			})

			expect(visitorCalls).toHaveLength(2)
			expect(visitorCalls[0].field.id).toBe('field1')
			expect(visitorCalls[0].value).toEqual({ isExpression: false, value: 'value1' })
			expect(visitorCalls[1].field.id).toBe('field2')
			expect(visitorCalls[1].value).toEqual({ isExpression: false, value: 50 })
		})

		it('should return object with visitor results keyed by field id', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
					},
					{
						id: 'field2',
						type: 'number',
						label: 'Field 2',
						min: 0,
						max: 100,
						default: 0,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				field2: exprVal(50),
			}

			const result = visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				return `transformed_${field.id}`
			})

			expect(result).toEqual({
				field1: 'transformed_field1',
				field2: 'transformed_field2',
			})
		})

		it('should handle undefined option values', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
					},
					{
						id: 'field2',
						type: 'number',
						label: 'Field 2',
						min: 0,
						max: 100,
						default: 0,
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				// field2 is missing
			}

			const visitorCalls: Array<{ field: SomeCompanionInputField; value: any }> = []
			const result = visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				visitorCalls.push({ field, value })
				return value ?? 'default'
			})

			expect(visitorCalls).toHaveLength(2)
			expect(visitorCalls[1].value).toBeUndefined()
			expect(result.field2).toBe('default')
		})
	})

	describe('edge cases', () => {
		it('should handle definition with no options', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [],
			})

			const options: ExpressionableOptionsObject = {}

			const result = visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				return value
			})

			expect(result).toEqual({})
		})

		it('should handle empty options object', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				optionsSupportExpressions: true,
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
					},
				],
			})

			const options: ExpressionableOptionsObject = {}

			const visitorCalls: Array<{ value: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				visitorCalls.push({ value })
				return value
			})

			expect(visitorCalls).toHaveLength(1)
			expect(visitorCalls[0].value).toBeUndefined()
		})

		it('should handle optionsSupportExpressions: undefined (treated as legacy)', () => {
			const definition: ClientEntityDefinition = createDefinition({
				label: 'Test',
				options: [
					{
						id: 'field1',
						type: 'textinput',
						label: 'Field 1',
						default: '',
						useVariables: CompanionFieldVariablesSupport.Basic,
					},
					{
						id: 'field2',
						type: 'textinput',
						label: 'Field 2',
						default: '',
					},
				],
			})

			const options: ExpressionableOptionsObject = {
				field1: exprVal('value1'),
				field2: exprVal('value2'),
			}

			const results: Array<{ field: SomeCompanionInputField; fieldType: any }> = []
			visitEntityOptionsForVariables(definition, options, (field, value, fieldType) => {
				results.push({ field, fieldType })
				return value
			})

			expect(results).toHaveLength(2)
			expect(results[0].fieldType).toEqual({
				allowExpression: false,
				parseVariables: true,
			})
			expect(results[1].fieldType).toBe(null)
		})
	})
})
