import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlButtonLayered } from '../../lib/Controls/ControlTypes/Button/Layered.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('button steps', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null })
	})
	afterEach(async () => {
		await app.close()
	})

	function getControl(controlId: string): ControlButtonLayered {
		return app.registry.controls.getControl(controlId) as ControlButtonLayered
	}

	test('auto step progression advances on release and runs the right action set', async () => {
		app.createCustomVariable('step', 'initial')

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		const control = getControl(controlId)

		const stepId1 = control.entities.getStepIds()[0]
		const stepId2 = await app.trpc().controls.steps.add({ controlId })
		if (!stepId2) throw new Error('Failed to add step')

		app.addInternalActionToStep(controlId, stepId1, 'custom_variable_set_value', {
			name: exprVal('step'),
			create: exprVal(false),
			value: exprVal('one'),
		})
		app.addInternalActionToStep(controlId, stepId2, 'custom_variable_set_value', {
			name: exprVal('step'),
			create: exprVal(false),
			value: exprVal('two'),
		})

		expect(control.entities.getActiveStepIndex()).toBe(0)

		// First press runs step 1; the step advances on release
		app.pressButton(location, true)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('step')).toBe('one')
		})
		expect(control.entities.getActiveStepIndex()).toBe(0)
		app.pressButton(location, false)
		expect(control.entities.getActiveStepIndex()).toBe(1)

		// Second press runs step 2 and wraps back around
		app.pressButton(location, true)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('step')).toBe('two')
		})
		app.pressButton(location, false)
		expect(control.entities.getActiveStepIndex()).toBe(0)
	})

	test('a button can change the step of another button, observed by a feedback', async () => {
		const locationA = { pageNumber: 1, row: 1, column: 1 }
		const controlA = app.createButton(locationA)
		await app.trpc().controls.steps.add({ controlId: controlA })

		const locationB = { pageNumber: 1, row: 1, column: 2 }
		const controlB = app.createButton(locationB)
		app.addInternalAction(controlB, 'bank_current_step_delta', {
			location: exprVal('1/1/1'),
			amount: exprVal(1),
		})
		const feedbackId = app.addInternalFeedback(controlB, 'bank_current_step', {
			location: exprVal('1/1/1'),
			step: exprVal(2),
		})

		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlB, feedbackId)).toBe(false)
		})

		app.pressButton(locationB, true)
		await vi.waitFor(() => {
			expect(getControl(controlA).entities.getActiveStepIndex()).toBe(1)
			expect(app.getFeedbackValue(controlB, feedbackId)).toBe(true)
		})
	})

	test('the http step endpoint changes the current step and rejects bad steps', async () => {
		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		await app.trpc().controls.steps.add({ controlId })

		await app.http.post('/api/location/1/1/1/step?step=2').expect(200)
		expect(getControl(controlId).entities.getActiveStepIndex()).toBe(1)

		await app.http.post('/api/location/1/1/1/step?step=9').expect(400)
		expect(getControl(controlId).entities.getActiveStepIndex()).toBe(1)
	})
})
