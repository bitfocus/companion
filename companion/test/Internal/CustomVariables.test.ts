import { describe, expect, it, vi } from 'vitest'
import { exprExpr, exprVal, type ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { ControlEntityInstance } from '../../lib/Controls/Entities/EntityInstance.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import { InternalCustomVariables } from '../../lib/Internal/CustomVariables.js'
import type { ActionForInternalExecution } from '../../lib/Internal/Types.js'
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

function makeVariablesController(currentValue: unknown, exists = true) {
	return {
		custom: {
			getValue: vi.fn().mockReturnValue(currentValue),
			hasCustomVariable: vi.fn().mockReturnValue(exists),
			setValue: vi.fn(),
			createVariable: vi.fn(),
			resetValueToDefault: vi.fn(),
			syncValueToDefault: vi.fn(),
		},
	}
}

// ---- custom_variable_set_value ----------------------------------------------

describe('custom_variable_set_value deferred parse', () => {
	it('sets variable to expression result using $(this:current)', () => {
		const variablesController = makeVariablesController(3)

		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction(
			'custom_variable_set_value',
			{ name: 'myVar', create: false, value: '$(this:current) * 2' },
			{
				name: exprVal('myVar'),
				create: exprVal(false),
				value: exprExpr('$(this:current) * 2'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.setValue).toHaveBeenCalledWith('myVar', 6)
	})

	it('sets variable using $(this:current) in text (non-expression) mode', () => {
		const variablesController = makeVariablesController('hello')

		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction(
			'custom_variable_set_value',
			{ name: 'myVar', create: false, value: 'prefix $(this:current) suffix' },
			{
				name: exprVal('myVar'),
				create: exprVal(false),
				value: exprVal('prefix $(this:current) suffix'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.setValue).toHaveBeenCalledWith('myVar', 'prefix hello suffix')
	})

	it('creates variable if not exists and create flag is set', () => {
		const variablesController = makeVariablesController(0, false)

		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction(
			'custom_variable_set_value',
			{ name: 'newVar', create: true, value: '$(this:current) + 10' },
			{
				name: exprVal('newVar'),
				create: exprVal(true),
				value: exprExpr('$(this:current) + 10'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.createVariable).toHaveBeenCalledWith('newVar', 10)
	})

	it('does nothing when variable does not exist and create flag is false', () => {
		const variablesController = makeVariablesController(0, false)

		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction(
			'custom_variable_set_value',
			{ name: 'missing', create: false, value: 'x' },
			{
				name: exprVal('missing'),
				create: exprVal(false),
				value: exprVal('x'),
			}
		)

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.setValue).not.toHaveBeenCalled()
		expect(variablesController.custom.createVariable).not.toHaveBeenCalled()
	})

	it('uses literal value when not using $(this:current)', () => {
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

	it('throws (and writes nothing) when the deferred value is an invalid expression', () => {
		// The value field defers parsing to execution time, so a broken expression only fails here.
		// The throw is contained by InternalController.executeAction's try/catch (logged, action
		// becomes a no-op) — the contract we lock in is that it fails before any partial write.
		const variablesController = makeVariablesController(3)

		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction(
			'custom_variable_set_value',
			{ name: 'myVar', create: false, value: '$(this:current) +' },
			{
				name: exprVal('myVar'),
				create: exprVal(false),
				value: exprExpr('$(this:current) +'), // invalid expression syntax
			}
		)

		expect(() => module.executeAction(action, fakeExtras, parser)).toThrow()
		expect(variablesController.custom.setValue).not.toHaveBeenCalled()
		expect(variablesController.custom.createVariable).not.toHaveBeenCalled()
	})
})

// ---- custom_variable_reset_to_default ---------------------------------------

describe('custom_variable_reset_to_default', () => {
	it('resets the named variable to its startup value', () => {
		const variablesController = makeVariablesController(0)
		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction('custom_variable_reset_to_default', { name: 'myVar' }, { name: exprVal('myVar') })

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.resetValueToDefault).toHaveBeenCalledWith('myVar')
	})

	it('does nothing when the name resolves to empty', () => {
		const variablesController = makeVariablesController(0)
		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction('custom_variable_reset_to_default', { name: '' }, { name: exprVal('') })

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.resetValueToDefault).not.toHaveBeenCalled()
	})
})

// ---- custom_variable_sync_to_default ----------------------------------------

describe('custom_variable_sync_to_default', () => {
	it('writes the current value to the startup value', () => {
		const variablesController = makeVariablesController(5)
		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction('custom_variable_sync_to_default', { name: 'myVar' }, { name: exprVal('myVar') })

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.syncValueToDefault).toHaveBeenCalledWith('myVar')
	})

	it('does nothing when the name resolves to empty', () => {
		const variablesController = makeVariablesController(5)
		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction('custom_variable_sync_to_default', { name: '' }, { name: exprVal('') })

		module.executeAction(action, fakeExtras, parser)

		expect(variablesController.custom.syncValueToDefault).not.toHaveBeenCalled()
	})
})

// ---- definitions & misc -----------------------------------------------------

describe('getActionDefinitions', () => {
	it('exposes the three custom variable actions', () => {
		const module = new InternalCustomVariables(makeVariablesController(0) as any)

		const defs = module.getActionDefinitions()

		expect(Object.keys(defs).sort()).toEqual([
			'custom_variable_reset_to_default',
			'custom_variable_set_value',
			'custom_variable_sync_to_default',
		])
		for (const def of Object.values(defs)) {
			expect(def.optionsSupportExpressions).toBe(true)
			expect(Array.isArray(def.options)).toBe(true)
		}
	})
})

describe('executeAction - unknown', () => {
	it('returns null for an unrecognised action', () => {
		const variablesController = makeVariablesController(0)
		const module = new InternalCustomVariables(variablesController as any)
		const parser = createParser()

		const action = makeAction('not_a_real_action', {}, {})

		expect(module.executeAction(action, fakeExtras, parser)).toBeNull()
	})
})
