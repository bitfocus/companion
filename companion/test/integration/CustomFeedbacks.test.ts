import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CUSTOM_FEEDBACKS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('custom feedbacks', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	/** Create a custom feedback which is true when the custom variable `level` is above its `min` input */
	async function createAboveCustomFeedback(): Promise<string> {
		const controlId = await app.trpc().controls.customFeedbacks.create({ name: 'Above' })
		await app.trpc().controls.customFeedbacks.inputAdd({
			controlId,
			field: { type: 'number', id: 'min', label: 'Min', default: 0, min: 0, max: 100 },
		})
		app.addInternalFeedback(controlId, 'check_expression', {
			expression: exprVal('$(custom:level) > $(options:min)'),
		})

		const parsedId = ParseControlId(controlId)
		if (parsedId?.type !== 'custom-feedback') throw new Error('Expected a custom feedback')
		await vi.waitFor(() => {
			expect(
				app.registry.instance.definitions.getEntityDefinition(
					EntityModelType.Feedback,
					CUSTOM_FEEDBACKS_CONNECTION_ID,
					parsedId.customFeedbackId
				)
			).toBeTruthy()
		})

		return parsedId.customFeedbackId
	}

	/** Give a button a feedback which uses a custom feedback, with the given `min` */
	async function addUse(buttonId: string, customFeedbackId: string, min: number): Promise<string> {
		const feedbackId = await app.trpc().controls.entities.add({
			controlId: buttonId,
			entityLocation: 'feedbacks',
			ownerId: null,
			connectionId: CUSTOM_FEEDBACKS_CONNECTION_ID,
			entityType: EntityModelType.Feedback,
			entityDefinition: customFeedbackId,
		})
		if (!feedbackId) throw new Error('Failed to add the feedback')
		await app.trpc().controls.entities.setOption({
			controlId: buttonId,
			entityLocation: 'feedbacks',
			entityId: feedbackId,
			key: 'min',
			value: exprVal(min),
		})
		return feedbackId
	}

	test('each use sees its own inputs, and follows the variables of its feedbacks', async () => {
		app.createCustomVariable('level', 1)
		const customFeedbackId = await createAboveCustomFeedback()

		const lowButton = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const lowId = await addUse(lowButton, customFeedbackId, 5)
		const highButton = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		const highId = await addUse(highButton, customFeedbackId, 10)

		await vi.waitFor(() => {
			expect(app.getFeedbackValue(lowButton, lowId)).toBe(false)
			expect(app.getFeedbackValue(highButton, highId)).toBe(false)
		})

		app.registry.variables.custom.setValue('level', 7)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(lowButton, lowId)).toBe(true)
			expect(app.getFeedbackValue(highButton, highId)).toBe(false)
		})

		app.registry.variables.custom.setValue('level', 20)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(lowButton, lowId)).toBe(true)
			expect(app.getFeedbackValue(highButton, highId)).toBe(true)
		})
	})

	test('a use follows a change to its inputs', async () => {
		app.createCustomVariable('level', 7)
		const customFeedbackId = await createAboveCustomFeedback()

		const button = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const feedbackId = await addUse(button, customFeedbackId, 5)
		await vi.waitFor(() => expect(app.getFeedbackValue(button, feedbackId)).toBe(true))

		await app.trpc().controls.entities.setOption({
			controlId: button,
			entityLocation: 'feedbacks',
			entityId: feedbackId,
			key: 'min',
			value: exprVal(8),
		})
		await vi.waitFor(() => expect(app.getFeedbackValue(button, feedbackId)).toBe(false))
	})
})
