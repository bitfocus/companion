import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { CreateBankControlId } from '@companion-app/shared/ControlId.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	INVALID_ENTITY_DEFINITION_ID,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { IControlStore } from '../../lib/Controls/IControlStore.js'
import type { RenderClock } from '../../lib/Controls/RenderClock.js'
import { InternalController } from '../../lib/Internal/Controller.js'
import { VariableDependencyRegistry } from '../../lib/Variables/DependencyRegistry.js'
import type { VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'

/**
 * Build an initialised {@link InternalController} with mocked collaborators. The fragments are real, so
 * the shared feedback-evaluation routine runs for real; only the surrounding controllers are mocked.
 */
function createController() {
	const controlStore = mockDeep<IControlStore>()
	const pageStore = mockDeep<any>()
	const instanceController = mockDeep<any>()
	const variablesController = mockDeep<any>()
	const variableDependencies = new VariableDependencyRegistry()
	variablesController.dependencies = variableDependencies
	const surfaceController = mockDeep<any>()
	const renderClock = mock<RenderClock>({ subscribe: vi.fn(() => () => {}) })

	// getVariableDefinitions on a couple of fragments iterate over these during init
	instanceController.getAllConnectionIds.mockReturnValue([])
	instanceController.connectionCollections.collectionData = []
	pageStore.getPageCount.mockReturnValue(0)
	surfaceController.getDevicesList.mockReturnValue([])

	const controller = new InternalController(
		controlStore,
		pageStore,
		instanceController,
		variablesController,
		renderClock
	)

	controller.init(
		anyMock(), // appInfo
		anyMock(), // controls
		instanceController,
		surfaceController,
		anyMock(), // graphicsController
		anyMock(), // userConfigController
		anyMock(), // localVariablesController
		new EventEmitter() as any, // controlEvents
		anyMock(), // actionRunner
		vi.fn() // requestExit
	)

	return { controller, controlStore, pageStore, instanceController, variableDependencies }
}

/** A deep mock returned as `any`, to keep the (irrelevant during these tests) init dependencies simple. */
function anyMock(): any {
	return mockDeep()
}

/** A parser stub whose parseEntityOptions returns a fixed parsed options object. */
function stubParser(parsedOptions: Record<string, any>): VariablesAndExpressionParser {
	return {
		parseEntityOptions: vi.fn(() => ({
			ok: true,
			parsedOptions,
			referencedVariableIds: new Set<string>(),
			clockSensitive: false,
		})),
	} as unknown as VariablesAndExpressionParser
}

describe('evaluateFeedbackValue', () => {
	test('evaluates an internal feedback live and does not write to the cache', () => {
		const { controller, controlStore, instanceController } = createController()

		instanceController.definitions.getEntityDefinition.mockReturnValue({
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Boolean,
			optionsSupportExpressions: true,
		} as any)

		const model: FeedbackEntityModel = {
			type: EntityModelType.Feedback,
			id: 'fb1',
			connectionId: 'internal',
			definitionId: 'check_expression',
			options: {},
			upgradeIndex: undefined,
		}

		controlStore.updateFeedbackValues.mockClear()

		// check_expression returns !!options.expression
		const parser = stubParser({ expression: true })
		const value = controller.evaluateFeedbackValue(model, CreateBankControlId('control1'), parser)

		expect(value).toBe(true)
		// The lazy path must never push into the feedback value cache
		expect(controlStore.updateFeedbackValues).not.toHaveBeenCalled()
	})

	test('reflects the supplied parser (not a cached value)', () => {
		const { controller, instanceController } = createController()

		instanceController.definitions.getEntityDefinition.mockReturnValue({
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Boolean,
			optionsSupportExpressions: true,
		} as any)

		const model: FeedbackEntityModel = {
			type: EntityModelType.Feedback,
			id: 'fb1',
			connectionId: 'internal',
			definitionId: 'check_expression',
			options: {},
			upgradeIndex: undefined,
		}

		expect(
			controller.evaluateFeedbackValue(model, CreateBankControlId('control1'), stubParser({ expression: true }))
		).toBe(true)
		expect(
			controller.evaluateFeedbackValue(model, CreateBankControlId('control1'), stubParser({ expression: false }))
		).toBe(false)
	})

	test('throws for a non-internal feedback', () => {
		const { controller } = createController()

		const model: FeedbackEntityModel = {
			type: EntityModelType.Feedback,
			id: 'fb1',
			connectionId: 'conn01',
			definitionId: 'check_expression',
			options: {},
			upgradeIndex: undefined,
		}

		expect(() => controller.evaluateFeedbackValue(model, CreateBankControlId('control1'), stubParser({}))).toThrow(
			'Feedback is not for internal instance'
		)
	})
})

describe("the placeholder for an entity that couldn't be loaded", () => {
	test('is published, hidden from the pickers, unlike the other internal definitions', () => {
		const { instanceController } = createController()

		const actions = instanceController.definitions.setActionDefinitions.mock.lastCall?.[1]
		const feedbacks = instanceController.definitions.setFeedbackDefinitions.mock.lastCall?.[1]

		expect(actions[INVALID_ENTITY_DEFINITION_ID]).toMatchObject({ hiddenFromPicker: true })
		expect(feedbacks[INVALID_ENTITY_DEFINITION_ID]).toMatchObject({ hiddenFromPicker: true })
		expect(actions['action_group']).toMatchObject({ hiddenFromPicker: false })
		expect(feedbacks['logic_operator']).toMatchObject({ hiddenFromPicker: false })
	})

	test('as a feedback, is never true', () => {
		const { controller, instanceController } = createController()

		instanceController.definitions.getEntityDefinition.mockReturnValue({
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Boolean,
			optionsSupportExpressions: false,
		} as any)

		const model: FeedbackEntityModel = {
			type: EntityModelType.Feedback,
			id: 'fb1',
			connectionId: 'internal',
			definitionId: INVALID_ENTITY_DEFINITION_ID,
			options: { original: { isExpression: false, value: { broken: true } } },
			upgradeIndex: undefined,
		}

		expect(controller.evaluateFeedbackValue(model, CreateBankControlId('control1'), stubParser({}))).toBe(false)
	})
})

describe('onVariablesChanged', () => {
	function makeFeedback(id: string): FeedbackEntityModel {
		return {
			type: EntityModelType.Feedback,
			id,
			connectionId: 'internal',
			definitionId: 'check_expression',
			options: {},
			upgradeIndex: undefined,
		}
	}

	/** Track a feedback on each of two controls, both referencing `local:x` and `custom:g` */
	function setup() {
		const ctx = createController()

		ctx.instanceController.definitions.getEntityDefinition.mockReturnValue({
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Boolean,
			optionsSupportExpressions: true,
		} as any)
		ctx.controlStore.createVariablesAndExpressionParser.mockReturnValue({
			parseEntityOptions: vi.fn(() => ({
				ok: true,
				parsedOptions: { expression: true },
				referencedVariableIds: new Set(['local:x', 'custom:g']),
				clockSensitive: false,
			})),
		} as any)

		ctx.controller.entityUpdate(makeFeedback('fb1'), CreateBankControlId('control1'), () =>
			ctx.controlStore.createVariablesAndExpressionParser(CreateBankControlId('control1'), null)
		)
		ctx.controller.entityUpdate(makeFeedback('fb2'), CreateBankControlId('control2'), () =>
			ctx.controlStore.createVariablesAndExpressionParser(CreateBankControlId('control2'), null)
		)
		ctx.controlStore.updateFeedbackValues.mockClear()

		return ctx
	}

	function updatedEntityIds(controlStore: ReturnType<typeof createController>['controlStore']): string[] {
		if (controlStore.updateFeedbackValues.mock.calls.length === 0) return []
		expect(controlStore.updateFeedbackValues).toHaveBeenCalledTimes(1)
		return controlStore.updateFeedbackValues.mock.calls[0][1].map((v) => v.entityId)
	}

	test('a global change re-evaluates every feedback referencing the variable', () => {
		const { controller, controlStore } = setup()

		controller.onVariablesChanged(new Set(['custom:g']), null)

		expect(updatedEntityIds(controlStore)).toEqual(['fb1', 'fb2'])
	})

	test('the normal variable change dispatch reaches the feedbacks', () => {
		const { controlStore, variableDependencies } = setup()

		variableDependencies.dispatch(new Set(['local:x']), new Set([CreateBankControlId('control1')]))

		expect(updatedEntityIds(controlStore)).toEqual(['fb1'])
	})

	test('only re-evaluates internal feedbacks, without notifying anything else', () => {
		const { controller, controlStore, variableDependencies } = setup()
		const otherListener = { onVariableDependenciesChanged: vi.fn() }
		variableDependencies.create(otherListener, CreateBankControlId('control1'), null).set(new Set(['local:x']))

		controller.onVariablesChanged(new Set(['local:x']), new Set([CreateBankControlId('control1')]))

		expect(updatedEntityIds(controlStore)).toEqual(['fb1'])
		expect(otherListener.onVariableDependenciesChanged).not.toHaveBeenCalled()
	})

	test('a scoped change only re-evaluates the feedbacks of the targeted controls', () => {
		const { controller, controlStore } = setup()

		controller.onVariablesChanged(new Set(['local:x']), new Set([CreateBankControlId('control2')]))

		expect(updatedEntityIds(controlStore)).toEqual(['fb2'])
	})

	test('ignores changes to unreferenced variables', () => {
		const { controller, controlStore } = setup()

		controller.onVariablesChanged(new Set(['local:y']), new Set([CreateBankControlId('control1')]))

		expect(updatedEntityIds(controlStore)).toEqual([])
	})

	test('a deleted feedback is no longer re-evaluated', () => {
		const { controller, controlStore } = setup()

		controller.entityDelete(makeFeedback('fb1'))
		controller.onVariablesChanged(
			new Set(['local:x']),
			new Set([CreateBankControlId('control1'), CreateBankControlId('control2')])
		)

		expect(updatedEntityIds(controlStore)).toEqual(['fb2'])
	})

	test('stops tracking the variables of every feedback when destroyed', () => {
		const { controller, controlStore, variableDependencies } = setup()

		controller.destroy()
		expect(variableDependencies.stats()).toEqual({ keys: 0, controls: 0, dependencies: 0, armed: 0 })

		variableDependencies.dispatch(new Set(['custom:g']), null)
		expect(controlStore.updateFeedbackValues).not.toHaveBeenCalled()
	})

	test('stops tracking the variables of deleted and replaced feedbacks', () => {
		const { controller, controlStore, variableDependencies } = setup()
		expect(variableDependencies.stats().dependencies).toBe(2)

		// Replacing a feedback swaps its tracking rather than adding to it
		controller.entityUpdate(makeFeedback('fb1'), CreateBankControlId('control1'), () =>
			controlStore.createVariablesAndExpressionParser(CreateBankControlId('control1'), null)
		)
		expect(variableDependencies.stats().dependencies).toBe(2)

		controller.entityDelete(makeFeedback('fb1'))
		controller.entityDelete(makeFeedback('fb2'))
		expect(variableDependencies.stats()).toEqual({ keys: 0, controls: 0, dependencies: 0, armed: 0 })
	})

	test('a feedback re-tracked on a different control follows it', () => {
		const { controller, controlStore } = setup()

		controller.entityUpdate(makeFeedback('fb1'), CreateBankControlId('control2'), () =>
			controlStore.createVariablesAndExpressionParser(CreateBankControlId('control2'), null)
		)
		controlStore.updateFeedbackValues.mockClear()

		controller.onVariablesChanged(new Set(['local:x']), new Set([CreateBankControlId('control1')]))
		expect(updatedEntityIds(controlStore)).toEqual([])

		controlStore.updateFeedbackValues.mockClear()
		controller.onVariablesChanged(new Set(['local:x']), new Set([CreateBankControlId('control2')]))
		expect(updatedEntityIds(controlStore).sort()).toEqual(['fb1', 'fb2'])
	})
})

describe('visitEntityReferences', () => {
	const fields = [{ type: 'internal:connection_id', id: 'conn', label: 'Connection', multiple: false }]

	test('visits the options described by the definition, rechecking a feedback by its id', () => {
		const { controller, instanceController } = createController()
		instanceController.definitions.getEntityDefinition.mockReturnValue({ options: fields } as any)
		const visitor = { visitConnectionId: vi.fn() } as any
		const options = { conn: exprVal('conn-1') }

		controller.visitEntityReferences(visitor, EntityModelType.Feedback, 'my_feedback', 'fb-1', options)

		expect(instanceController.definitions.getEntityDefinition).toHaveBeenCalledWith(
			EntityModelType.Feedback,
			'internal',
			'my_feedback'
		)
		expect(visitor.visitConnectionId).toHaveBeenCalledWith(options, 'conn', 'fb-1')
	})

	test('does not pass an id for an action', () => {
		const { controller, instanceController } = createController()
		instanceController.definitions.getEntityDefinition.mockReturnValue({ options: fields } as any)
		const visitor = { visitConnectionId: vi.fn() } as any
		const options = { conn: exprVal('conn-1') }

		controller.visitEntityReferences(visitor, EntityModelType.Action, 'my_action', 'act-1', options)

		expect(visitor.visitConnectionId).toHaveBeenCalledWith(options, 'conn', undefined)
	})

	test('does nothing for an unknown definition', () => {
		const { controller, instanceController } = createController()
		instanceController.definitions.getEntityDefinition.mockReturnValue(undefined)
		const visitor = { visitConnectionId: vi.fn() } as any

		controller.visitEntityReferences(visitor, EntityModelType.Action, 'missing', 'act-1', {
			conn: exprVal('conn-1'),
		})

		expect(visitor.visitConnectionId).not.toHaveBeenCalled()
	})
})
