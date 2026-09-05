import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('internal feedbacks', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	test('variable_value feedback re-evaluates when the variable changes', async () => {
		app.createCustomVariable('watch', 'no')

		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const feedbackId = app.addInternalFeedback(controlId, 'variable_value', {
			variable: exprVal('custom:watch'),
			op: exprVal('eq'),
			value: exprVal('yes'),
		})

		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(false)
		})

		app.registry.variables.custom.setValue('watch', 'yes')
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(true)
		})

		app.registry.variables.custom.setValue('watch', 'no')
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(false)
		})
	})

	test('check_expression feedback tracks multiple variables', async () => {
		app.createCustomVariable('x', 1)
		app.createCustomVariable('y', 2)

		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const feedbackId = app.addInternalFeedback(controlId, 'check_expression', {
			expression: exprVal('$(custom:x) + $(custom:y) == 3'),
		})

		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(true)
		})

		app.registry.variables.custom.setValue('y', 5)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(false)
		})

		app.registry.variables.custom.setValue('x', -2)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(true)
		})
	})

	test('bank_pushed feedback follows another button being pressed', async () => {
		const locationA = { pageNumber: 1, row: 1, column: 1 }
		app.createButton(locationA)
		const controlB = app.createButton({ pageNumber: 1, row: 1, column: 2 })

		const feedbackId = app.addInternalFeedback(controlB, 'bank_pushed', {
			location: exprVal('1/1/1'),
			latch_compatability: exprVal(false),
		})

		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlB, feedbackId)).toBe(false)
		})

		app.pressButton(locationA, true)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlB, feedbackId)).toBe(true)
		})

		app.pressButton(locationA, false)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlB, feedbackId)).toBe(false)
		})
	})
})
