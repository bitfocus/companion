import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CUSTOM_FEEDBACKS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId, type CustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import type { CustomFeedbackUse } from '@companion-app/shared/Model/CustomFeedbackModel.js'
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
		await app.trpc().controls.customFeedbacks.inputs.add({
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

	/** The current uses of a custom feedback, as the editor sees them */
	async function readUses(controlId: CustomFeedbackControlId): Promise<CustomFeedbackUse[]> {
		const iterable = await app.trpc().controls.customFeedbacks.watchUses({ controlId })
		const iterator = iterable[Symbol.asyncIterator]()
		try {
			const { value } = await iterator.next()
			return value as CustomFeedbackUse[]
		} finally {
			await iterator.return?.()
		}
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

	test.each([
		['false', 9, 'below'],
		['true', 2, 'above'],
	])(
		'the condition of an action sees what the actions before it have just done, when that makes it %s',
		async (_name, newMin, expected) => {
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
				value: exprVal(newMin),
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
			app.addInternalChildAction(
				buttonId,
				{ parentId: logicIfId, childGroup: 'actions' },
				'custom_variable_set_value',
				{
					name: exprVal('out'),
					create: exprVal(false),
					value: exprVal('above'),
				}
			)

			// Before the press, the condition is true for the starting value of `min`, so a false result can only come from
			// the change made by the action before it
			await vi.waitFor(() => expect(app.getFeedbackValue(buttonId, conditionId)).toBe(true))

			app.pressButton(location, true)
			await new Promise((resolve) => setTimeout(resolve, 200))
			expect(app.getCustomVariableValue('out')).toBe(expected)
		}
	)

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

	test('the uses list each feedback using it, wherever it is, and whether it is disabled', async () => {
		app.createCustomVariable('level', 1)
		const customFeedbackId = await createAboveCustomFeedback()
		const controlId = `custom-feedback:${customFeedbackId}` as CustomFeedbackControlId

		const firstButton = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const firstUse = await addUse(firstButton, customFeedbackId, 5)
		const secondButton = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		const secondUse = await addUse(secondButton, customFeedbackId, 5)
		await app.trpc().controls.entities.setEnabled({
			controlId: secondButton,
			entityLocation: 'feedbacks',
			entityId: secondUse,
			enabled: false,
		})

		// A use inside another custom feedback counts too
		const outer = await app.trpc().controls.customFeedbacks.create({ name: 'Outer' })
		const outerUse = await app.trpc().controls.entities.add({
			controlId: outer,
			entityLocation: 'feedbacks',
			ownerId: null,
			connectionId: CUSTOM_FEEDBACKS_CONNECTION_ID,
			entityType: EntityModelType.Feedback,
			entityDefinition: customFeedbackId,
		})

		expect(await readUses(controlId)).toEqual(
			expect.arrayContaining([
				{ controlId: firstButton, entityId: firstUse, disabled: false },
				{ controlId: secondButton, entityId: secondUse, disabled: true },
				{ controlId: outer, entityId: outerUse, disabled: false },
			])
		)
		expect(await readUses(controlId)).toHaveLength(3)

		await app.trpc().controls.entities.remove({
			controlId: firstButton,
			entityLocation: 'feedbacks',
			entityId: firstUse,
		})
		expect((await readUses(controlId)).map((use) => use.entityId).sort()).toEqual([secondUse, outerUse].sort())
	})

	test('a clone is a custom feedback of its own, with the same inputs and feedbacks', async () => {
		app.createCustomVariable('level', 7)
		const customFeedbackId = await createAboveCustomFeedback()
		const controlId = `custom-feedback:${customFeedbackId}` as CustomFeedbackControlId

		const cloneId = await app.trpc().controls.customFeedbacks.clone({ controlId })
		if (!cloneId) throw new Error('Failed to clone')
		const parsedClone = ParseControlId(cloneId)
		if (parsedClone?.type !== 'custom-feedback') throw new Error('Expected a custom feedback')

		const original = app.registry.controls.getControl(controlId)
		const clone = app.registry.controls.getControl(cloneId)
		if (!(original instanceof ControlCustomFeedback) || !(clone instanceof ControlCustomFeedback))
			throw new Error('Expected custom feedbacks')
		expect(clone.options.name).toBe('Above (copy)')
		expect(clone.inputs).toEqual(original.inputs)
		expect(clone.entities.getFeedbackEntities().map((entity) => entity.rawOptions)).toEqual(
			original.entities.getFeedbackEntities().map((entity) => entity.rawOptions)
		)

		// It can be used, and doesn't change with the original
		await vi.waitFor(() =>
			expect(
				app.registry.instance.definitions.getEntityDefinition(
					EntityModelType.Feedback,
					CUSTOM_FEEDBACKS_CONNECTION_ID,
					parsedClone.customFeedbackId
				)
			).toBeTruthy()
		)
		const button = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const useId = await addUse(button, parsedClone.customFeedbackId, 5)
		await vi.waitFor(() => expect(app.getFeedbackValue(button, useId)).toBe(true))

		app.addInternalFeedback(controlId, 'check_expression', { expression: exprVal('false') })
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(app.getFeedbackValue(button, useId)).toBe(true)
	})

	test('deleting it stops it being offered, and its uses become false', async () => {
		app.createCustomVariable('level', 7)
		const customFeedbackId = await createAboveCustomFeedback()
		const controlId = `custom-feedback:${customFeedbackId}` as CustomFeedbackControlId

		const button = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const useId = await addUse(button, customFeedbackId, 5)
		await vi.waitFor(() => expect(app.getFeedbackValue(button, useId)).toBe(true))

		expect(await app.trpc().controls.customFeedbacks.delete({ controlId })).toBe(true)

		await vi.waitFor(() => {
			expect(
				app.registry.instance.definitions.getEntityDefinition(
					EntityModelType.Feedback,
					CUSTOM_FEEDBACKS_CONNECTION_ID,
					customFeedbackId
				)
			).toBeFalsy()
			expect(app.getFeedbackValue(button, useId)).toBe(false)
		})
	})

	test('the condition of an action in a custom action sees the inputs of the custom action', async () => {
		app.createCustomVariable('level', 5)
		app.createCustomVariable('out', '')
		const customFeedbackId = await createAboveCustomFeedback()

		const customActionId = await app.trpc().controls.customActions.create({ name: 'Check' })
		await app.trpc().controls.customActions.inputs.add({
			controlId: customActionId,
			field: { type: 'number', id: 'limit', label: 'Limit', default: 0, min: 0, max: 100 },
		})
		// The actions must run one after the other, for the condition to be checked after `out` is reset
		const groupId = app.addCustomActionAction(customActionId, null, 'action_group', {
			execution_mode: exprVal('sequential'),
		})
		const inGroup = { parentId: groupId, childGroup: 'default' }
		app.addCustomActionAction(customActionId, inGroup, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprVal('below'),
		})
		const logicIfId = app.addCustomActionAction(customActionId, inGroup, 'logic_if', {})
		const conditionId = await app.trpc().controls.entities.add({
			controlId: customActionId,
			entityLocation: 'custom_action_actions',
			ownerId: { parentId: logicIfId, childGroup: 'condition' },
			connectionId: CUSTOM_FEEDBACKS_CONNECTION_ID,
			entityType: EntityModelType.Feedback,
			entityDefinition: customFeedbackId,
		})
		if (!conditionId) throw new Error('Failed to add the condition')
		await app.trpc().controls.entities.setOption({
			controlId: customActionId,
			entityLocation: 'custom_action_actions',
			entityId: conditionId,
			key: 'min',
			value: exprExpr('$(options:limit)'),
		})
		app.addCustomActionAction(
			customActionId,
			{ parentId: logicIfId, childGroup: 'actions' },
			'custom_variable_set_value',
			{
				name: exprVal('out'),
				create: exprVal(false),
				value: exprVal('above'),
			}
		)

		const lowLocation = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(lowLocation), customActionId, { limit: exprVal(3) }, null)
		const highLocation = { pageNumber: 1, row: 1, column: 2 }
		app.addCustomActionCall(app.createButton(highLocation), customActionId, { limit: exprVal(9) }, null)

		const press = (location: typeof lowLocation) => {
			app.pressButton(location, true)
			app.pressButton(location, false)
		}

		press(lowLocation)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('above'))

		press(highLocation)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('below'))

		press(lowLocation)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('above'))
	})
})
