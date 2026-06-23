import { describe, expect, it, vi } from 'vitest'
import { exprExpr, exprVal, type ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { ControlEntityInstance } from '../../lib/Controls/Entities/EntityInstance.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
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

	it('sets variable to expression result using $(this:current)', () => {
		const localVar: LocalVariable = { controlId: 'ctrl1', name: 'counter' }
		const context = { 'this:current': 5, 'target:counter': 5 }
		const localVariables = makeLocalVariablesController(localVar, context)

		const module = new InternalVariables(localVariables)
		const parser = createParser()

		const action = makeAction(
			'local_variable_set_value',
			{ location: 'this', name: 'counter', value: '$(this:current) + 1' },
			{
				location: exprVal('this'),
				name: exprVal('counter'),
				value: exprExpr('$(this:current) + 1'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(localVariables.setLocalVariable).toHaveBeenCalledWith(localVar, 6)
	})

	it('sets variable using $(target:foo) in text (non-expression) mode', () => {
		const localVar: LocalVariable = { controlId: 'ctrl1', name: 'msg' }
		const context = { 'this:current': '', 'target:greeting': 'hello' }
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

	it('falls back to empty context when the variable is found but context is null', () => {
		// Exercises the `getLocalVariableContextFor(...) ?? {}` fallback: the variable resolves but
		// has no context, so the value must still be written with this:current left unresolved.
		const localVar: LocalVariable = { controlId: 'ctrl1', name: 'counter' }
		const localVariables = makeLocalVariablesController(localVar, null) // found, but no context

		const module = new InternalVariables(localVariables)
		const parser = createParser()

		const action = makeAction(
			'local_variable_set_value',
			{ location: 'this', name: 'counter', value: '$(this:current)' },
			{
				location: exprVal('this'),
				name: exprVal('counter'),
				value: exprVal('$(this:current)'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		// Variable was found, so it is still written; with no context, $(this:current) is unknown
		expect(localVariables.setLocalVariable).toHaveBeenCalledWith(localVar, '$NA')
	})

	it('throws (and writes nothing) when the deferred value is an invalid expression', () => {
		// The value field defers parsing to execution time, so a broken expression only fails here.
		// The throw is contained by InternalController.executeAction's try/catch (logged, action
		// becomes a no-op) — the contract we lock in is that it fails before any partial write.
		const localVar: LocalVariable = { controlId: 'ctrl1', name: 'counter' }
		const context = { 'this:current': 5, 'target:counter': 5 }
		const localVariables = makeLocalVariablesController(localVar, context)

		const module = new InternalVariables(localVariables)
		const parser = createParser()

		const action = makeAction(
			'local_variable_set_value',
			{ location: 'this', name: 'counter', value: '$(this:current) +' },
			{
				location: exprVal('this'),
				name: exprVal('counter'),
				value: exprExpr('$(this:current) +'), // invalid expression syntax
			}
		)

		expect(() => module.executeAction(action, fakeExtras, parser)).toThrow()
		expect(localVariables.setLocalVariable).not.toHaveBeenCalled()
	})
})

// ---- reset / sync actions ---------------------------------------------------

function makeFullLocalVariablesController(localVariable: LocalVariable | null): LocalVariablesController {
	return {
		localVariableFor: vi.fn().mockReturnValue(localVariable),
		getLocalVariableContextFor: vi.fn().mockReturnValue({}),
		setLocalVariable: vi.fn(),
		resetLocalVariable: vi.fn(),
		writeLocalVariableStartupValue: vi.fn(),
	} as unknown as LocalVariablesController
}

describe('local_variable_reset_to_default', () => {
	it('resets the resolved local variable', () => {
		const localVar: LocalVariable = { controlId: 'ctrl1', name: 'counter' }
		const localVariables = makeFullLocalVariablesController(localVar)
		const module = new InternalVariables(localVariables)

		const action = makeAction(
			'local_variable_reset_to_default',
			{ location: 'this', name: 'counter' },
			{ location: exprVal('this'), name: exprVal('counter') }
		)

		module.executeAction(action, fakeExtras, createParser())

		expect(localVariables.resetLocalVariable).toHaveBeenCalledWith(localVar)
	})

	it('does nothing when the local variable is not found', () => {
		const localVariables = makeFullLocalVariablesController(null)
		const module = new InternalVariables(localVariables)

		const action = makeAction(
			'local_variable_reset_to_default',
			{ location: 'this', name: 'missing' },
			{ location: exprVal('this'), name: exprVal('missing') }
		)

		module.executeAction(action, fakeExtras, createParser())

		expect(localVariables.resetLocalVariable).not.toHaveBeenCalled()
	})
})

describe('local_variable_sync_to_default', () => {
	it('writes the current value to the startup value', () => {
		const localVar: LocalVariable = { controlId: 'ctrl1', name: 'counter' }
		const localVariables = makeFullLocalVariablesController(localVar)
		const module = new InternalVariables(localVariables)

		const action = makeAction(
			'local_variable_sync_to_default',
			{ location: 'this', name: 'counter' },
			{ location: exprVal('this'), name: exprVal('counter') }
		)

		module.executeAction(action, fakeExtras, createParser())

		expect(localVariables.writeLocalVariableStartupValue).toHaveBeenCalledWith(localVar)
	})

	it('does nothing when the local variable is not found', () => {
		const localVariables = makeFullLocalVariablesController(null)
		const module = new InternalVariables(localVariables)

		const action = makeAction(
			'local_variable_sync_to_default',
			{ location: 'this', name: 'missing' },
			{ location: exprVal('this'), name: exprVal('missing') }
		)

		module.executeAction(action, fakeExtras, createParser())

		expect(localVariables.writeLocalVariableStartupValue).not.toHaveBeenCalled()
	})
})

describe('executeAction - unknown', () => {
	it('returns null for an unrecognised action', () => {
		const module = new InternalVariables(makeFullLocalVariablesController(null))

		const action = makeAction('not_a_real_action', {}, {})

		expect(module.executeAction(action, fakeExtras, createParser())).toBeNull()
	})
})

// ---- executeFeedback --------------------------------------------------------

function makeFeedback(definitionId: string, options: Record<string, unknown>) {
	return {
		controlId: 'ctrl1',
		location: undefined,
		id: 'fb1',
		definitionId,
		options: options as any,
	}
}

describe('executeFeedback - variable_value', () => {
	const module = new InternalVariables(makeFullLocalVariablesController(null))

	it('reports true when the variable equals the value', () => {
		const parser = createParser({ custom: { foo: '5' } })
		const result = module.executeFeedback(
			makeFeedback('variable_value', { variable: 'custom:foo', op: 'eq', value: '5' }),
			parser
		)
		expect(result).toMatchObject({ value: true })
	})

	it('reports false when the variable differs', () => {
		const parser = createParser({ custom: { foo: '5' } })
		const result = module.executeFeedback(
			makeFeedback('variable_value', { variable: 'custom:foo', op: 'eq', value: '6' }),
			parser
		)
		expect(result).toMatchObject({ value: false })
	})

	it('supports the gt operator', () => {
		const parser = createParser({ custom: { foo: '10' } })
		const result = module.executeFeedback(
			makeFeedback('variable_value', { variable: 'custom:foo', op: 'gt', value: '5' }),
			parser
		)
		expect(result).toMatchObject({ value: true })
	})

	it('returns false when no variable is configured', () => {
		const result = module.executeFeedback(makeFeedback('variable_value', { variable: '', op: 'eq', value: '5' }), createParser())
		expect(result).toBe(false)
	})
})

describe('executeFeedback - variable_variable', () => {
	const module = new InternalVariables(makeFullLocalVariablesController(null))

	it('compares two variables for equality', () => {
		const parser = createParser({ custom: { a: '5', b: '5' } })
		const result = module.executeFeedback(
			makeFeedback('variable_variable', { variable: 'custom:a', op: 'eq', variable2: 'custom:b' }),
			parser
		)
		expect(result).toMatchObject({ value: true })
	})

	it('returns false when either variable is missing', () => {
		const result = module.executeFeedback(
			makeFeedback('variable_variable', { variable: 'custom:a', op: 'eq', variable2: '' }),
			createParser({ custom: { a: '5' } })
		)
		expect(result).toBe(false)
	})
})

describe('executeFeedback - expression based', () => {
	const module = new InternalVariables(makeFullLocalVariablesController(null))

	it('check_expression returns the truthiness of the evaluated option', () => {
		expect(module.executeFeedback(makeFeedback('check_expression', { expression: true }), createParser())).toBe(true)
		expect(module.executeFeedback(makeFeedback('check_expression', { expression: false }), createParser())).toBe(false)
	})

	it('expression_value returns the evaluated option directly', () => {
		expect(module.executeFeedback(makeFeedback('expression_value', { expression: 42 }), createParser())).toBe(42)
	})

	it('user_value is not evaluated here and returns false', () => {
		expect(module.executeFeedback(makeFeedback('user_value', {}), createParser())).toBe(false)
	})

	it('debug_expression_value coerces non-objects to an empty style', () => {
		expect(module.executeFeedback(makeFeedback('debug_expression_value', { expression: 'not-an-object' }), createParser())).toEqual({})
		expect(
			module.executeFeedback(makeFeedback('debug_expression_value', { expression: { color: 1 } }), createParser())
		).toEqual({ color: 1 })
	})
})

// ---- definitions & visitReferences ------------------------------------------

describe('definitions', () => {
	const module = new InternalVariables(makeFullLocalVariablesController(null))

	it('exposes the three local variable actions', () => {
		expect(Object.keys(module.getActionDefinitions()).sort()).toEqual([
			'local_variable_reset_to_default',
			'local_variable_set_value',
			'local_variable_sync_to_default',
		])
	})

	it('exposes the variable feedbacks (debug feedback only when not packaged)', () => {
		const keys = Object.keys(module.getFeedbackDefinitions())
		expect(keys).toEqual(
			expect.arrayContaining(['variable_value', 'variable_variable', 'check_expression', 'expression_value', 'user_value'])
		)
	})
})

describe('visitReferences', () => {
	const module = new InternalVariables(makeFullLocalVariablesController(null))

	it('visits the variable name option of variable_value feedbacks', () => {
		const visitor = { visitVariableName: vi.fn(), visitString: vi.fn() } as any
		const feedback = { id: 'fb1', type: 'variable_value', options: { variable: 'custom:foo' } } as any

		module.visitReferences(visitor, [], [feedback])

		expect(visitor.visitVariableName).toHaveBeenCalledWith(feedback.options, 'variable', 'fb1')
	})

	it('visits both variable names of variable_variable feedbacks', () => {
		const visitor = { visitVariableName: vi.fn(), visitString: vi.fn() } as any
		const feedback = { id: 'fb2', type: 'variable_variable', options: { variable: 'custom:a', variable2: 'custom:b' } } as any

		module.visitReferences(visitor, [], [feedback])

		expect(visitor.visitVariableName).toHaveBeenCalledWith(feedback.options, 'variable', 'fb2')
		expect(visitor.visitVariableName).toHaveBeenCalledWith(feedback.options, 'variable2', 'fb2')
	})
})
