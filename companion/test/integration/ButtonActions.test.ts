import { afterEach, describe, expect, test, vi } from 'vitest'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('button action execution', () => {
	let app: TestApp
	afterEach(async () => {
		await app.close()
	})

	test('pressing a button runs an internal action', async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })

		app.createCustomVariable('result', 'initial')

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('result'),
			create: exprVal(false),
			value: exprVal('pressed!'),
		})

		app.pressButton(location, true)

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('result')).toBe('pressed!')
		})
	})

	test('action options can be expressions evaluated against the real variable store', async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })

		app.createCustomVariable('counter', 0)

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('counter'),
			create: exprVal(false),
			value: exprExpr('$(custom:counter) + 1'),
		})

		app.pressButton(location, true)
		app.pressButton(location, false)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('counter')).toBe(1)
		})

		app.pressButton(location, true)
		app.pressButton(location, false)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('counter')).toBe(2)
		})
	})

	test('the wait action splits the chain without blocking the earlier actions', async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })

		app.createCustomVariable('before', 'initial')
		app.createCustomVariable('after', 'initial')

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('before'),
			create: exprVal(false),
			value: exprVal('yes'),
		})
		app.addInternalAction(controlId, 'wait', {
			time: exprVal('750'),
		})
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('after'),
			create: exprVal(false),
			value: exprVal('yes'),
		})

		app.pressButton(location, true)

		// The action before the wait runs immediately, the one after it must not have
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('before')).toBe('yes')
		})
		expect(app.getCustomVariableValue('after')).toBe('initial')

		await vi.waitFor(
			() => {
				expect(app.getCustomVariableValue('after')).toBe('yes')
			},
			{ timeout: 5000 }
		)
	})

	test('logic_if only runs its children when the condition is true', async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })

		app.createCustomVariable('flag', 'yes')
		app.createCustomVariable('count', 0)

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		const logicIfId = app.addInternalAction(controlId, 'logic_if', {})
		app.addInternalChildFeedback(controlId, { parentId: logicIfId, childGroup: 'condition' }, 'check_expression', {
			expression: exprVal(`$(custom:flag) == 'yes'`),
		})
		app.addInternalChildAction(controlId, { parentId: logicIfId, childGroup: 'actions' }, 'custom_variable_set_value', {
			name: exprVal('count'),
			create: exprVal(false),
			value: exprExpr('$(custom:count) + 1'),
		})

		app.pressButton(location, true)
		app.pressButton(location, false)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('count')).toBe(1)
		})

		// With the condition false the child action must not run
		app.registry.variables.custom.setValue('flag', 'no')
		app.pressButton(location, true)
		app.pressButton(location, false)

		// A third press with the condition true again proves the second press never incremented
		app.registry.variables.custom.setValue('flag', 'yes')
		app.pressButton(location, true)
		app.pressButton(location, false)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('count')).toBe(2)
		})
	})

	test('a button can press another button by location', async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })

		app.createCustomVariable('result', 'initial')

		const locationA = { pageNumber: 1, row: 1, column: 1 }
		const locationB = { pageNumber: 1, row: 1, column: 2 }
		const controlA = app.createButton(locationA)
		const controlB = app.createButton(locationB)

		app.addInternalAction(controlA, 'button_pressrelease', {
			location: exprVal('1/1/2'),
			force: exprVal(false),
		})
		app.addInternalAction(controlB, 'custom_variable_set_value', {
			name: exprVal('result'),
			create: exprVal(false),
			value: exprVal('pressed via A'),
		})

		app.pressButton(locationA, true)

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('result')).toBe('pressed via A')
		})
	})
})
