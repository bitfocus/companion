import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlButtonLayered } from '../../lib/Controls/ControlTypes/Button/Layered.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('internal actions and feedbacks through button-references', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		// createTestApp() may have rejected before assigning, so guard so teardown can't mask that error
		await app?.close()
	})

	const targetA = { pageNumber: 1, row: 1, column: 1 }
	const targetB = { pageNumber: 1, row: 1, column: 2 }
	const referenceLocation = { pageNumber: 1, row: 2, column: 1 }
	const controllerLocation = { pageNumber: 1, row: 3, column: 1 }

	function getControl(controlId: string): ControlButtonLayered {
		return app.registry.controls.getControl(controlId) as ControlButtonLayered
	}

	/** Create two-step target buttons, and a reference whose target is chosen by the `target` custom variable */
	async function setupReference(): Promise<{ controlA: string; controlB: string }> {
		const controlA = app.createButton(targetA)
		await app.trpc().controls.steps.add({ controlId: controlA })
		const controlB = app.createButton(targetB)
		await app.trpc().controls.steps.add({ controlId: controlB })

		app.createCustomVariable('target', '1/1/1')
		const referenceId = await app
			.trpc()
			.controls.createReferenceControl({ fromLocation: targetA, toLocation: referenceLocation })
		if (!referenceId) throw new Error('Failed to create reference')
		await app.trpc().controls.setOptionsField({
			controlId: referenceId,
			key: 'location',
			value: exprVal('$(custom:target)'),
		})

		return { controlA, controlB }
	}

	test('bank_current_step_delta changes the step of the referenced button, observed by a feedback', async () => {
		const { controlA, controlB } = await setupReference()

		const controller = app.createButton(controllerLocation)
		app.addInternalAction(controller, 'bank_current_step_delta', {
			location: exprVal('1/2/1'),
			amount: exprVal(1),
		})
		const feedbackId = app.addInternalFeedback(controller, 'bank_current_step', {
			location: exprVal('1/2/1'),
			step: exprVal(2),
		})

		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(false)
		})

		app.pressButton(controllerLocation, true)
		app.pressButton(controllerLocation, false)
		await vi.waitFor(() => {
			expect(getControl(controlA).entities.getActiveStepIndex()).toBe(1)
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(true)
		})
		expect(getControl(controlB).entities.getActiveStepIndex()).toBe(0)

		// Re-pointing the reference at a button still on step 1 updates the feedback
		app.registry.variables.custom.setValue('target', '1/1/2')
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(false)
		})

		// And the action now steps the new target
		app.pressButton(controllerLocation, true)
		app.pressButton(controllerLocation, false)
		await vi.waitFor(() => {
			expect(getControl(controlB).entities.getActiveStepIndex()).toBe(1)
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(true)
		})
		expect(getControl(controlA).entities.getActiveStepIndex()).toBe(1)
	})

	test('bank_current_step sets the step of the referenced button', async () => {
		const { controlA } = await setupReference()

		const controller = app.createButton(controllerLocation)
		app.addInternalAction(controller, 'bank_current_step', {
			location: exprVal('1/2/1'),
			step: exprVal(2),
		})

		app.pressButton(controllerLocation, true)
		await vi.waitFor(() => {
			expect(getControl(controlA).entities.getActiveStepIndex()).toBe(1)
		})
	})

	test('bank_pushed follows the referenced button, including when re-pointed', async () => {
		await setupReference()

		const controller = app.createButton(controllerLocation)
		const feedbackId = app.addInternalFeedback(controller, 'bank_pushed', {
			location: exprVal('1/2/1'),
			latch_compatability: exprVal(false),
		})

		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(false)
		})

		app.pressButton(targetA, true)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(true)
		})

		// Re-pointing at a released button updates the feedback, while A is still held
		app.registry.variables.custom.setValue('target', '1/1/2')
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(false)
		})

		app.pressButton(targetB, true)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(true)
		})

		app.pressButton(targetB, false)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controller, feedbackId)).toBe(false)
		})
	})
})
