import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { IControlStore } from '../../lib/Controls/IControlStore.js'
import type { RenderClock } from '../../lib/Controls/RenderClock.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import { buildActionExecutionOverrides, InternalController } from '../../lib/Internal/Controller.js'
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
	const surfaceController = mockDeep<any>()
	const renderClock = mock<RenderClock>({ subscribe: vi.fn(() => () => {}) })

	// getVariableDefinitions on a couple of fragments iterate over these during init
	instanceController.getAllConnectionIds.mockReturnValue([])
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

	return { controller, controlStore, pageStore, instanceController }
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
		const value = controller.evaluateFeedbackValue(model, 'control1', parser)

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

		expect(controller.evaluateFeedbackValue(model, 'control1', stubParser({ expression: true }))).toBe(true)
		expect(controller.evaluateFeedbackValue(model, 'control1', stubParser({ expression: false }))).toBe(false)
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

		expect(() => controller.evaluateFeedbackValue(model, 'control1', stubParser({}))).toThrow(
			'Feedback is not for internal instance'
		)
	})
})

describe('buildActionExecutionOverrides', () => {
	function makeExtras(overrides: Partial<RunActionExtras>): RunActionExtras {
		return {
			controlId: 'control1',
			surfaceId: undefined,
			location: undefined,
			abortDelayed: new AbortController().signal,
			executionMode: 'concurrent',
			rotationDelta: null,
			...overrides,
		}
	}

	test('exposes this:surface_id and this:delta for a rotary execution', () => {
		const overrides = buildActionExecutionOverrides(makeExtras({ surfaceId: 'surface0', rotationDelta: -3 }))
		expect(overrides['this:surface_id']).toBe('surface0')
		expect(overrides['this:delta']).toBe(-3)
	})

	test('this:delta is undefined for a non-rotary execution', () => {
		const overrides = buildActionExecutionOverrides(makeExtras({ surfaceId: 'surface0', rotationDelta: null }))
		expect(overrides['this:surface_id']).toBe('surface0')
		expect(overrides['this:delta']).toBeUndefined()
	})
})
