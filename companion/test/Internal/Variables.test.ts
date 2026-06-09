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
