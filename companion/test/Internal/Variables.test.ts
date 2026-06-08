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
