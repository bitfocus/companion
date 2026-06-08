import { describe, expect, it, vi } from 'vitest'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal, type ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { ControlEntityInstance } from '../../lib/Controls/Entities/EntityInstance.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import { InternalCustomVariables } from '../../lib/Internal/CustomVariables.js'
import type { ActionForInternalExecution } from '../../lib/Internal/Types.js'
import { InternalVariables } from '../../lib/Internal/Variables.js'
import type { LocalVariable, LocalVariablesController } from '../../lib/Variables/LocalVariablesController.js'
import type { VariableValueData } from '../../lib/Variables/Util.js'
import { VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'

// ---- helpers ----------------------------------------------------------------

const defaultVariables: VariableValueData = {}

function createParser(variables: VariableValueData = defaultVariables): VariablesAndExpressionParser {
	return new VariablesAndExpressionParser(null as any, variables, new Map(), null, null)
}

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
		optionsSupportExpressions: true,
		showButtonPreview: false,
		supportsChildGroups: [],
		...partial,
	}
}

function makeAction(
	definitionId: string,
	parsedOptions: Record<string, unknown>,
	rawOptionsMap: ExpressionableOptionsObject
): ActionForInternalExecution {
	const rawEntity = {
		rawOptions: rawOptionsMap,
	} as unknown as ControlEntityInstance
	return {
		id: 'test-id',
		definitionId,
		options: parsedOptions as any,
		rawEntity,
	}
}

const fakeExtras: RunActionExtras = {
	controlId: 'ctrl1',
	surfaceId: undefined,
	location: undefined,
	abortDelayed: new AbortController().signal,
	executionMode: 'sequential',
}

// ---- deferParsing passthrough -----------------------------------------------

describe('deferParsing field passthrough in parseEntityOptions', () => {
	it('returns the raw value string without variable substitution', () => {
		const parser = createParser({ test: { foo: 'hello' } })
		const definition = createDefinition({
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
		})
		const options: ExpressionableOptionsObject = {
			value: exprVal('$(test:foo) world'),
		}

		const result = parser.parseEntityOptions(definition, options)

		expect(result.ok).toBe(true)
		if (result.ok) {
			// Variable is NOT substituted — the raw string is passed through
			expect(result.parsedOptions.value).toBe('$(test:foo) world')
			// No referenced variables tracked
			expect(result.referencedVariableIds.size).toBe(0)
		}
	})

	it('returns the raw expression string without evaluation', () => {
		const parser = createParser({ test: { num: 10 } })
		const definition = createDefinition({
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
		})
		const options: ExpressionableOptionsObject = {
			value: exprExpr('$(test:num) + 5'),
		}

		const result = parser.parseEntityOptions(definition, options)

		expect(result.ok).toBe(true)
		if (result.ok) {
			// Expression is NOT evaluated — raw string passed through
			expect(result.parsedOptions.value).toBe('$(test:num) + 5')
		}
	})
})

// ---- createChildParser with this:value injection ----------------------------

describe('createChildParser injects this:value', () => {
	it('resolves $(this:value) via parseVariables', () => {
		const parent = createParser()
		const child = parent.createChildParser({ 'this:value': '42' })

		const result = child.parseVariables('$(this:value)')
		expect(result.text).toBe('42')
	})

	it('resolves $(this:value) in an expression', () => {
		const parent = createParser()
		const child = parent.createChildParser({ 'this:value': 10 })

		const result = child.executeExpression('$(this:value) + 1', undefined)
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.value).toBe(11)
	})

	it('resolves $(target:foo) via parseVariables', () => {
		const parent = createParser()
		const child = parent.createChildParser({ 'this:value': 0, 'target:counter': 5 })

		const result = child.parseVariables('count=$(target:counter)')
		expect(result.text).toBe('count=5')
	})
})

// ---- local_variable_set_value -----------------------------------------------

describe('local_variable_set_value deferred parse', () => {
	function makeLocalVariablesController(
		localVariable: LocalVariable | null,
		context: Record<string, unknown> | null
	): LocalVariablesController {
		return {
			localVariableFor: vi.fn().mockReturnValue(localVariable),
			getLocalVariableContextFor: vi.fn().mockReturnValue(context),
			setLocalVariable: vi.fn(),
		} as unknown as LocalVariablesController
	}

	it('sets variable to expression result using $(this:value)', () => {
		const localVar: LocalVariable = { controlId: 'ctrl1', name: 'counter' }
		const context = { 'this:value': 5, 'target:counter': 5 }
		const localVariables = makeLocalVariablesController(localVar, context)

		const module = new InternalVariables(localVariables)
		const parser = createParser()

		const action = makeAction(
			'local_variable_set_value',
			{ location: 'this', name: 'counter', value: '$(this:value) + 1' },
			{
				location: exprVal('this'),
				name: exprVal('counter'),
				value: exprExpr('$(this:value) + 1'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(localVariables.setLocalVariable).toHaveBeenCalledWith(localVar, 6)
	})

	it('sets variable using $(target:foo) in text (non-expression) mode', () => {
		const localVar: LocalVariable = { controlId: 'ctrl1', name: 'msg' }
		const context = { 'this:value': '', 'target:greeting': 'hello' }
		const localVariables = makeLocalVariablesController(localVar, context)

		const module = new InternalVariables(localVariables)
		const parser = createParser()

		const action = makeAction(
			'local_variable_set_value',
			{ location: 'this', name: 'msg', value: '$(target:greeting) world' },
			{
				location: exprVal('this'),
				name: exprVal('msg'),
				value: exprVal('$(target:greeting) world'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(localVariables.setLocalVariable).toHaveBeenCalledWith(localVar, 'hello world')
	})

	it('does nothing if local variable is not found', () => {
		const localVariables = makeLocalVariablesController(null, null)

		const module = new InternalVariables(localVariables)
		const parser = createParser()

		const action = makeAction(
			'local_variable_set_value',
			{ location: 'this', name: 'missing', value: 'x' },
			{
				location: exprVal('this'),
				name: exprVal('missing'),
				value: exprVal('x'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(localVariables.setLocalVariable).not.toHaveBeenCalled()
	})
})

// ---- custom_variable_set_value ----------------------------------------------

describe('custom_variable_set_value deferred parse', () => {
	function makeVariablesController(currentValue: unknown, exists = true) {
		return {
			custom: {
				getValue: vi.fn().mockReturnValue(currentValue),
				hasCustomVariable: vi.fn().mockReturnValue(exists),
				setValue: vi.fn(),
				createVariable: vi.fn(),
			},
		}
	}

	it('sets variable to expression result using $(this:value)', () => {
		const variablesController = makeVariablesController(3)

		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction(
			'custom_variable_set_value',
			{ name: 'myVar', create: false, value: '$(this:value) * 2' },
			{
				name: exprVal('myVar'),
				create: exprVal(false),
				value: exprExpr('$(this:value) * 2'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.setValue).toHaveBeenCalledWith('myVar', 6)
	})

	it('creates variable if not exists and create flag is set', () => {
		const variablesController = makeVariablesController(0, false)

		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction(
			'custom_variable_set_value',
			{ name: 'newVar', create: true, value: '$(this:value) + 10' },
			{
				name: exprVal('newVar'),
				create: exprVal(true),
				value: exprExpr('$(this:value) + 10'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.createVariable).toHaveBeenCalledWith('newVar', 10)
	})

	it('uses literal value when not using $(this:value)', () => {
		const variablesController = makeVariablesController('old')

		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction(
			'custom_variable_set_value',
			{ name: 'myVar', create: false, value: 'literal' },
			{
				name: exprVal('myVar'),
				create: exprVal(false),
				value: exprVal('literal'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.setValue).toHaveBeenCalledWith('myVar', 'literal')
	})
})
