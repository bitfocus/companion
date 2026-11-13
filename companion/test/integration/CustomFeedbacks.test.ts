import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CUSTOM_FEEDBACKS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import { ControlCustomFeedback } from '../../lib/Controls/ControlTypes/CustomFeedback.js'
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

	test('the condition of an action sees what the actions before it have just done', async () => {
		app.createCustomVariable('level', 5)
		app.createCustomVariable('out', '')
		const customFeedbackId = await createAboveCustomFeedback()

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(location)
		const buttonControl = app.registry.controls.getControl(buttonId)
		if (!buttonControl?.supportsEntities) throw new Error('Expected a button')
		const stepId = (buttonControl.entities as unknown as { getStepIds(): string[] }).getStepIds()[0]
		const downSet = { stepId, setId: 'down' }

		// A local variable `min`, which starts as 0 so the custom feedback is true until an action changes it
		const variableId = await app.trpc().controls.entities.add({
			controlId: buttonId,
			entityLocation: 'local-variables',
			ownerId: null,
			connectionId: 'internal',
			entityType: EntityModelType.Feedback,
			entityDefinition: 'user_value',
		})
		if (!variableId) throw new Error('Failed to add the local variable')
		await app.trpc().controls.entities.setVariableName({
			controlId: buttonId,
			entityLocation: 'local-variables',
			entityId: variableId,
			name: 'min',
		})

		// The actions must run one after the other, for the condition to follow the change to `min`
		const groupId = app.addInternalAction(buttonId, 'action_group', { execution_mode: exprVal('sequential') })
		const inGroup = { parentId: groupId, childGroup: 'default' }
		app.addInternalChildAction(buttonId, inGroup, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprVal('below'),
		})
		app.addInternalChildAction(buttonId, inGroup, 'local_variable_set_value', {
			location: exprVal('this'),
			name: exprVal('min'),
			value: exprVal(9),
		})
		const logicIfId = app.addInternalChildAction(buttonId, inGroup, 'logic_if', {})
		const conditionId = await app.trpc().controls.entities.add({
			controlId: buttonId,
			entityLocation: downSet,
			ownerId: { parentId: logicIfId, childGroup: 'condition' },
			connectionId: CUSTOM_FEEDBACKS_CONNECTION_ID,
			entityType: EntityModelType.Feedback,
			entityDefinition: customFeedbackId,
		})
		if (!conditionId) throw new Error('Failed to add the condition')
		await app.trpc().controls.entities.setOption({
			controlId: buttonId,
			entityLocation: downSet,
			entityId: conditionId,
			key: 'min',
			value: exprExpr('$(local:min)'),
		})
		app.addInternalChildAction(buttonId, { parentId: logicIfId, childGroup: 'actions' }, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprVal('above'),
		})

		// Before the press, the condition is true for the starting value of `min`
		await vi.waitFor(() => expect(app.getFeedbackValue(buttonId, conditionId)).toBe(true))

		app.pressButton(location, true)
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(app.getCustomVariableValue('out')).toBe('below')
	})

	test('custom feedbacks which use each other in a loop are told so', async () => {
		const first = await app.trpc().controls.customFeedbacks.create({ name: 'First' })
		const second = await app.trpc().controls.customFeedbacks.create({ name: 'Second' })
		const idOf = (controlId: string) => {
			const parsedId = ParseControlId(controlId)
			if (parsedId?.type !== 'custom-feedback') throw new Error('Expected a custom feedback')
			return parsedId.customFeedbackId
		}

		const addUseOf = async (controlId: string, usedControlId: string) => {
			await vi.waitFor(() =>
				expect(
					app.registry.instance.definitions.getEntityDefinition(
						EntityModelType.Feedback,
						CUSTOM_FEEDBACKS_CONNECTION_ID,
						idOf(usedControlId)
					)
				).toBeTruthy()
			)
			const id = await app.trpc().controls.entities.add({
				controlId,
				entityLocation: 'feedbacks',
				ownerId: null,
				connectionId: CUSTOM_FEEDBACKS_CONNECTION_ID,
				entityType: EntityModelType.Feedback,
				entityDefinition: idOf(usedControlId),
			})
			expect(id).toBeTruthy()
		}
		await addUseOf(first, second)
		await addUseOf(second, first)

		await vi.waitFor(() => {
			const definition = app.registry.instance.definitions.getEntityDefinition(
				EntityModelType.Feedback,
				CUSTOM_FEEDBACKS_CONNECTION_ID,
				idOf(first)
			)
			expect(definition?.warning).toBe('It uses itself through "Second". That use is always false.')
		})

		const control = app.registry.controls.getControl(first)
		if (!(control instanceof ControlCustomFeedback)) throw new Error('Expected a custom feedback')
		expect(control.toClientJSON()).toMatchObject({
			calledCustomFeedbackIds: [idOf(first), idOf(second)].sort(),
			callLoop: [idOf(first), idOf(second), idOf(first)],
			nestedTooDeep: false,
		})
	})
})
