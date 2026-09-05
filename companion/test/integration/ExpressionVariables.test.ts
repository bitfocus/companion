import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlExpressionVariable } from '../../lib/Controls/ControlTypes/ExpressionVariable.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('expression variables', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	/** Create an expression variable and configure it the way the ui does */
	async function createExpressionVariable(name: string, expression: string): Promise<string> {
		const controlId = await app.trpc().controls.expressionVariables.create()

		const control = app.registry.controls.getControl(controlId) as ControlExpressionVariable
		const entityId = control.entities.getRootEntity()!.id

		// The option is of type 'expression', so the plain value string is evaluated as an expression
		await app.trpc().controls.entities.setOption({
			controlId,
			entityLocation: 'feedbacks',
			entityId,
			key: 'expression',
			value: exprVal(expression),
		})
		await app.trpc().controls.setOptionsField({ controlId, key: 'variableName', value: name })

		return controlId
	}

	function expressionValue(name: string): unknown {
		return app.registry.variables.values.getVariableValue('expression', name)
	}

	test('an expression variable re-evaluates when its dependencies change', async () => {
		app.createCustomVariable('counter', 21)

		await createExpressionVariable('doubled', '$(custom:counter) * 2')

		await vi.waitFor(() => {
			expect(expressionValue('doubled')).toBe(42)
		})

		app.registry.variables.custom.setValue('counter', 50)
		await vi.waitFor(() => {
			expect(expressionValue('doubled')).toBe(100)
		})
	})

	test('expression variables can chain off each other', async () => {
		app.createCustomVariable('base', 10)

		await createExpressionVariable('first', '$(custom:base) + 1')
		await createExpressionVariable('second', '$(expression:first) * 10')

		await vi.waitFor(() => {
			expect(expressionValue('second')).toBe(110)
		})

		app.registry.variables.custom.setValue('base', 20)
		await vi.waitFor(() => {
			expect(expressionValue('second')).toBe(210)
		})
	})

	test('deleting an expression variable clears its value', async () => {
		const controlId = await createExpressionVariable('doomed', '1 + 1')

		await vi.waitFor(() => {
			expect(expressionValue('doomed')).toBe(2)
		})

		await app.trpc().controls.expressionVariables.delete({ controlId })
		await vi.waitFor(() => {
			expect(expressionValue('doomed')).toBeUndefined()
		})
	})
})
