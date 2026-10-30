import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { mock } from 'vitest-mock-extended'
import { CUSTOM_FEEDBACKS_CONNECTION_ID, INTERNAL_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import type { CustomFeedbackModel } from '@companion-app/shared/Model/CustomFeedbackModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { exprVal, type AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import type { ControlDependencies } from '../../../lib/Controls/ControlDependencies.js'
import { ControlStore } from '../../../lib/Controls/ControlStore.js'
import { ControlCustomFeedback } from '../../../lib/Controls/ControlTypes/CustomFeedback.js'
import { CustomActionInstanceManager } from '../../../lib/Controls/CustomActions/CustomActionInstanceManager.js'
import { CustomFeedbackInstanceManager } from '../../../lib/Controls/CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'
import type { InternalController } from '../../../lib/Internal/Controller.js'
import { VariablesValues } from '../../../lib/Variables/Values.js'
import { mockUserConfig } from '../../utils/MockUserConfig.js'

const CUSTOM_FEEDBACK_ID = 'abc'
const CUSTOM_FEEDBACK_CONTROL_ID = CreateCustomFeedbackControlId(CUSTOM_FEEDBACK_ID)
const CALLER_CONTROL_ID = CreateCustomFeedbackControlId('caller')

let nextId = 0
/** An internal boolean feedback, which is true when its expression is truthy */
function check(expression: string): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `check-${nextId++}`,
		connectionId: INTERNAL_CONNECTION_ID,
		definitionId: 'check_expression',
		options: { expression: exprVal(expression) },
		upgradeIndex: undefined,
	}
}
function useFeedback(options: FeedbackEntityModel['options'] = {}, customFeedbackId = CUSTOM_FEEDBACK_ID) {
	return {
		type: EntityModelType.Feedback,
		id: `use-${nextId++}`,
		connectionId: CUSTOM_FEEDBACKS_CONNECTION_ID,
		definitionId: customFeedbackId,
		options,
		upgradeIndex: undefined,
	} satisfies FeedbackEntityModel
}
function computedValue(variableName: string, expression: string): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `local-${nextId++}`,
		connectionId: INTERNAL_CONNECTION_ID,
		definitionId: 'computed',
		options: { expression: exprVal(expression) },
		upgradeIndex: undefined,
		variableName,
	}
}
function moduleValue(variableName: string): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `local-${nextId++}`,
		connectionId: 'conn',
		definitionId: 'level',
		options: {},
		upgradeIndex: undefined,
		variableName,
	}
}

const numberInput: AuthorableInputField = {
	type: 'number',
	id: 'n',
	label: 'N',
	default: 3,
	min: 0,
	max: 10,
}

/**
 * Stand up a custom feedback, with the real classes which give the feedbacks using it their values. The internal
 * module is a stand in, which evaluates the expression of a `check_expression` feedback when it is subscribed, as the
 * real one does
 */
function createHarness(model: Partial<CustomFeedbackModel>) {
	const variableValues = new VariablesValues(mockUserConfig({ timezone: '' }))

	const pageStore = {
		getLocationOfControlId: vi.fn(() => null),
		getControlIdAt: vi.fn(() => null),
		getPageId: vi.fn(() => undefined),
	}

	const db = { getSchemaTableView: vi.fn(() => ({ set: vi.fn(), delete: vi.fn(), all: vi.fn(() => ({})) })) }
	const controlStore = new ControlStore(db as any, variableValues, pageStore as any)

	const internalModule = mock<InternalController>()
	internalModule.evaluateFeedbackValue.mockImplementation((entityModel, _controlId, parser) => {
		// The 'computed' feedback evaluates its expression
		const expression = entityModel.options.expression?.value
		if (typeof expression !== 'string') return undefined
		const res = parser.executeExpression(expression, undefined)
		return res.ok ? res.value : undefined
	})
	internalModule.entityUpdate.mockImplementation((entityModel, controlId, createParser) => {
		if (entityModel.type !== EntityModelType.Feedback || entityModel.definitionId !== 'check_expression') return
		if (entityModel.disabled) return

		const expression = entityModel.options.expression?.value
		if (typeof expression !== 'string') return

		const res = createParser().executeExpression(expression, undefined)
		controlStore.updateFeedbackValues(INTERNAL_CONNECTION_ID, [
			{ entityId: entityModel.id, controlId, value: res.ok && !!res.value },
		])
	})

	const getEntityDefinition = (
		entityType: EntityModelType,
		connectionId: string,
		definitionId: string
	): ClientEntityDefinition | undefined => {
		if (entityType !== EntityModelType.Feedback) return undefined
		if (connectionId === CUSTOM_FEEDBACKS_CONNECTION_ID) {
			const control = controlStore.getControl(CreateCustomFeedbackControlId(definitionId))
			return control instanceof ControlCustomFeedback ? control.toFeedbackDefinition() : undefined
		}
		if (definitionId === 'check_expression') {
			return {
				entityType,
				feedbackType: FeedbackEntitySubType.Boolean,
				showInvert: true,
				options: [],
				optionsSupportExpressions: true,
			} as Partial<ClientEntityDefinition> as any
		}
		return {
			entityType,
			feedbackType: FeedbackEntitySubType.Value,
			options: [],
			optionsSupportExpressions: true,
		} as Partial<ClientEntityDefinition> as any
	}

	const processManager = {
		connectionEntityUpdate: vi.fn(async (_entity: ControlEntityInstance, _controlId: string) => true),
		connectionEntityDelete: vi.fn(async (_entity: SomeEntityModel, _controlId: string) => true),
	}

	const renderClock = { subscribe: vi.fn(() => () => {}) } as any
	const customFeedbackInstances = new CustomFeedbackInstanceManager(controlStore, renderClock)
	const customActionInstances = new CustomActionInstanceManager(controlStore, renderClock, customFeedbackInstances)

	const deps: ControlDependencies = {
		surfaces: null as any,
		pageStore: pageStore as any,
		getPageVariableEntities: () => null,
		triggerEvents: null as any,
		expressionVariableNamesMap: null as any,
		internalModule,
		instance: {
			definitions: { getEntityDefinition },
			processManager,
		} as any,
		variableValues,
		userconfig: mockUserConfig({ timezone: '' }),
		graphics: null as any,
		actionRunner: null as any,
		dbTable: { set: vi.fn(), delete: vi.fn() } as any,
		events: new EventEmitter() as any,
		changeEvents: new EventEmitter() as any,
		renderClock,
		controlsAccessor: controlStore,
		linkButtons: null as any,
		customActionInstances,
		customFeedbackInstances,
	}

	// As the controls controller does, keep the copies held by calling feedbacks up to date
	deps.events.on('customFeedbackDefinitionChanged', (controlId: string) =>
		customFeedbackInstances.onCustomEntityChanged(controlId)
	)

	const storage: CustomFeedbackModel = {
		type: 'custom-feedback',
		options: { ...ControlCustomFeedback.DefaultOptions },
		inputs: [numberInput],
		feedbacks: [],
		localVariables: [],
		...model,
	}
	const control = new ControlCustomFeedback(deps, CUSTOM_FEEDBACK_CONTROL_ID, structuredClone(storage), false)
	controlStore.controls.set(CUSTOM_FEEDBACK_CONTROL_ID, control)

	/** Create a control holding a feedback which uses the custom feedback, and get the feedback */
	const createCaller = (entity: FeedbackEntityModel) => {
		const caller = new ControlCustomFeedback(deps, CALLER_CONTROL_ID, null, false)
		controlStore.controls.set(caller.controlId, caller)
		caller.entities.entityAdd('feedbacks', null, entity)
		const callerEntity = caller.entities.getFeedbackEntities()[0]
		return { caller, callerEntity }
	}

	return { deps, control, controlStore, processManager, customFeedbackInstances, createCaller }
}

/** Wait for the value of a feedback which uses a custom feedback to settle */
async function expectValue(entity: ControlEntityInstance, value: boolean): Promise<void> {
	await vi.waitFor(() => expect(entity.getBooleanFeedbackValue(null)).toBe(value))
}

describe('ControlCustomFeedback', () => {
	describe('feedback definition', () => {
		test('is a boolean feedback, with the inputs as its options', () => {
			const { control } = createHarness({
				options: { ...ControlCustomFeedback.DefaultOptions, name: 'My feedback', description: 'desc' },
			})

			expect(control.toFeedbackDefinition()).toMatchObject({
				entityType: EntityModelType.Feedback,
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'My feedback',
				description: 'desc',
				options: [numberInput],
				showInvert: true,
				optionsSupportExpressions: true,
			})
		})

		test('emits a change when edited', () => {
			const { deps, control } = createHarness({})
			const listener = vi.fn()
			deps.events.on('customFeedbackDefinitionChanged', listener)

			control.optionsSetField('name', 'Renamed')

			expect(listener).toHaveBeenCalledWith(CUSTOM_FEEDBACK_CONTROL_ID)
		})
	})

	describe('feedbacks', () => {
		test('a feedback which uses the custom feedback itself can not be added', () => {
			const { control } = createHarness({})

			expect(control.entities.entityAdd('feedbacks', null, useFeedback())).toBe(false)
			expect(control.entities.getFeedbackEntities()).toHaveLength(0)
		})

		test('a feedback using another custom feedback can be added', () => {
			const { deps, control, controlStore } = createHarness({})
			const other = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId('other'), null, false)
			controlStore.controls.set(other.controlId, other)

			expect(control.entities.entityAdd('feedbacks', null, useFeedback({}, 'other'))).toBe(true)
		})
	})

	describe('value of a feedback using it', () => {
		test('is true when all of its feedbacks are, seeing the inputs given', async () => {
			const { createCaller } = createHarness({
				feedbacks: [check('$(options:n) > 4'), check('$(options:n) < 8')],
			})

			const { caller, callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)

			caller.entities.entitySetOption('feedbacks', callerEntity.id, 'n', exprVal(9))
			await expectValue(callerEntity, false)

			caller.entities.entitySetOption('feedbacks', callerEntity.id, 'n', exprVal(6))
			await expectValue(callerEntity, true)
		})

		test('keeps its value when an input changes without changing it', async () => {
			const { createCaller } = createHarness({ feedbacks: [check('$(options:n) > 4')] })

			const { caller, callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)

			// Changing an option clears the value of the feedback, so it must be given it again
			caller.entities.entitySetOption('feedbacks', callerEntity.id, 'n', exprVal(6))
			expect(callerEntity.feedbackValue).toBeUndefined()
			await expectValue(callerEntity, true)
		})

		test('uses the default for an input which is not given', async () => {
			const { createCaller } = createHarness({ feedbacks: [check('$(options:n) == 3')] })

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, true)
		})

		test('is false when it has no feedbacks', async () => {
			const { createCaller, controlStore } = createHarness({ feedbacks: [] })
			const updateSpy = vi.spyOn(controlStore, 'updateFeedbackValues')

			const { callerEntity } = createCaller(useFeedback())

			await vi.waitFor(() =>
				expect(updateSpy).toHaveBeenCalledWith(CUSTOM_FEEDBACKS_CONNECTION_ID, [
					{ entityId: callerEntity.id, controlId: CALLER_CONTROL_ID, value: false },
				])
			)
			expect(callerEntity.getBooleanFeedbackValue(null)).toBe(false)
		})

		test('can be inverted', async () => {
			const { createCaller } = createHarness({ feedbacks: [check('true')] })

			const { callerEntity } = createCaller({ ...useFeedback(), isInverted: exprVal(true) })
			await expectValue(callerEntity, false)
		})

		test('sees the local variables of its copy, computed from the inputs', async () => {
			const { createCaller } = createHarness({
				localVariables: [computedValue('double', '$(options:n) * 2')],
				feedbacks: [check('$(local:double) == 10')],
			})

			const { callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)
		})

		test('follows a local variable which a connection gives a new value', async () => {
			const { createCaller, controlStore } = createHarness({
				localVariables: [moduleValue('level')],
				feedbacks: [check('$(local:level) > 5')],
			})

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, false)
			// Let the copy be rebuilt for the creation of the custom feedback, so that it is not replaced below
			await new Promise((resolve) => setTimeout(resolve, 150))

			// The connection reports the value for the copy of the local variable held by the caller
			const [localVariable] = callerEntity
				.getTransientChildGroup('custom-feedback-copy:local-variables')!
				.getDirectEntities()
			controlStore.updateFeedbackValues('conn', [
				{ entityId: localVariable.id, controlId: CALLER_CONTROL_ID, value: 7 },
			])
			await expectValue(callerEntity, true)

			controlStore.updateFeedbackValues('conn', [
				{ entityId: localVariable.id, controlId: CALLER_CONTROL_ID, value: 2 },
			])
			await expectValue(callerEntity, false)
		})

		test('follows a change to the custom feedback', async () => {
			const { control, createCaller } = createHarness({ feedbacks: [check('true')] })

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, true)

			control.entities.entityAdd('feedbacks', null, check('false'))
			await expectValue(callerEntity, false)
		})

		test('is false once the custom feedback is deleted', async () => {
			const { control, controlStore, createCaller } = createHarness({ feedbacks: [check('true')] })

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, true)

			control.destroy()
			controlStore.controls.delete(CUSTOM_FEEDBACK_CONTROL_ID)
			await expectValue(callerEntity, false)
		})

		test('can use another custom feedback, with its own inputs', async () => {
			const { deps, controlStore, createCaller } = createHarness({
				feedbacks: [useFeedback({ n: { isExpression: true, value: '$(options:n) + 1' } }, 'inner')],
			})

			const inner = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId('inner'), null, false)
			controlStore.controls.set(inner.controlId, inner)
			inner.inputAdd(numberInput)
			inner.entities.entityAdd('feedbacks', null, check('$(options:n) == 6'))

			const { callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)
		})

		test('a module feedback in the copy is subscribed for the control of the caller', async () => {
			const { createCaller, processManager } = createHarness({
				feedbacks: [{ ...moduleValue('unused'), variableName: undefined }],
			})

			createCaller(useFeedback())

			await vi.waitFor(() =>
				expect(processManager.connectionEntityUpdate).toHaveBeenCalledWith(
					expect.objectContaining({ connectionId: 'conn' }),
					CALLER_CONTROL_ID
				)
			)
		})
	})
})
