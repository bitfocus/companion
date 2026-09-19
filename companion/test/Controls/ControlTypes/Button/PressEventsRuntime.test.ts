import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LayeredButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { EntityModelType, type ActionEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { ButtonPressEvents } from '../../../../lib/Controls/ButtonPressEvents.js'
import type { ControlDependencies } from '../../../../lib/Controls/ControlDependencies.js'
import { ControlButtonLayered } from '../../../../lib/Controls/ControlTypes/Button/Layered.js'

const CONTROL_ID = 'bank:press-events-test'

function action(id: string, disabled = false): ActionEntityModel {
	return {
		id,
		type: EntityModelType.Action,
		connectionId: 'conn1',
		definitionId: 'action1',
		options: {},
		upgradeIndex: undefined,
		disabled,
	}
}

function storage(options: {
	down?: ActionEntityModel[]
	up?: ActionEntityModel[]
	durations?: Record<number, ActionEntityModel[]>
	runWhileHeld?: number[]
	controlEventsDisabledSets?: Array<'down' | 'up' | number>
}): LayeredButtonModel {
	return {
		type: 'button-layered',
		options: { rotaryActions: false, stepProgression: 'manual', canModifyStyleInApis: false },
		style: { layers: [] },
		feedbacks: [],
		localVariables: [],
		steps: {
			'0': {
				options: {
					runWhileHeld: options.runWhileHeld ?? [],
					controlEventsDisabledSets: options.controlEventsDisabledSets,
				},
				action_sets: {
					down: options.down ?? [],
					up: options.up ?? [],
					rotate_left: undefined,
					rotate_right: undefined,
					...options.durations,
				},
			},
		},
	}
}

function createControl(model: LayeredButtonModel, runMultipleActions = vi.fn(async () => {})) {
	const definitions = Object.assign(new EventEmitter(), {
		getEntityDefinition: vi.fn((entityType: EntityModelType) => ({ entityType })),
	})
	const graphics = Object.assign(new EventEmitter(), {
		renderPixelBuffers: vi.fn(),
		getCachedRender: vi.fn(() => undefined),
	})
	const actionRunner = {
		runMultipleActions,
		abortAll: vi.fn(),
		abortSingle: vi.fn(),
	}
	const deps: ControlDependencies = {
		surfaces: {} as any,
		pageStore: { getLocationOfControlId: vi.fn(() => ({ pageNumber: 1, row: 0, column: 0 })) } as any,
		getPageVariableEntities: () => null,
		triggerEvents: null as any,
		expressionVariableNamesMap: null as any,
		internalModule: {
			entityUpdate: vi.fn(),
			entityDelete: vi.fn(),
			entityUpgrade: vi.fn(() => undefined),
			executeLogicFeedback: vi.fn(),
			evaluateFeedbackValue: vi.fn(),
			onVariablesChanged: vi.fn(),
			visitReferences: vi.fn(),
		} as any,
		instance: {
			definitions,
			processManager: {
				connectionEntityUpdate: vi.fn(async () => undefined),
				connectionEntityDelete: vi.fn(async () => undefined),
				connectionEntityLearnOptions: vi.fn(async () => undefined),
			},
			getInstanceStatus: vi.fn(() => undefined),
		} as any,
		variableValues: {
			createVariablesAndExpressionParser: vi.fn(() => ({
				executeExpression: vi.fn(() => ({ ok: true, value: 1, variableIds: new Set<string>() })),
			})),
		} as any,
		userconfig: {} as any,
		graphics: graphics as any,
		actionRunner: actionRunner as any,
		dbTable: { set: vi.fn(), delete: vi.fn() } as any,
		events: new EventEmitter() as any,
		changeEvents: new EventEmitter() as any,
		renderClock: { subscribe: vi.fn(() => () => {}) } as any,
		controlsAccessor: {
			getControl: vi.fn(() => undefined),
			pressControl: vi.fn(() => false),
			rotateControl: vi.fn(() => false),
		},
	}

	return { control: new ControlButtonLayered(deps, CONTROL_ID, model, false), runMultipleActions, actionRunner }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

describe('button automatic press event dispatch', () => {
	test('sends an event for an eligible enabled top-level action', () => {
		const { control, runMultipleActions } = createControl(storage({ down: [action('down1')] }))
		const send = vi.fn()

		control.pressControl(true, 'surface1', new ButtonPressEvents(send), false)

		expect(runMultipleActions).toHaveBeenCalledTimes(1)
		expect(send).toHaveBeenCalledTimes(1)
		control.destroy()
	})

	test.each([
		['all actions disabled', storage({ down: [action('down1', true)] })],
		['group preference disabled', storage({ down: [action('down1')], controlEventsDisabledSets: ['down'] })],
	] as const)('does not send an event when %s', (_name, model) => {
		const { control } = createControl(model)
		const send = vi.fn()

		control.pressControl(true, 'surface1', new ButtonPressEvents(send), false)

		expect(send).not.toHaveBeenCalled()
		control.destroy()
	})

	test('does not send an event for a synthetic press with no physical context', () => {
		const { control, runMultipleActions } = createControl(storage({ down: [action('down1')] }))

		control.pressControl(true, 'synthetic-surface', null, false)

		expect(runMultipleActions).toHaveBeenCalledTimes(1)
		control.destroy()
	})

	test('does not wait for asynchronous action completion before requesting feedback', async () => {
		let resolveAction!: () => void
		const pendingAction = new Promise<void>((resolve) => {
			resolveAction = resolve
		})
		const runMultipleActions = vi.fn(async () => pendingAction)
		const { control } = createControl(storage({ down: [action('down1')] }), runMultipleActions)
		const send = vi.fn()

		control.pressControl(true, 'surface1', new ButtonPressEvents(send), false)

		expect(send).toHaveBeenCalledTimes(1)
		resolveAction()
		await pendingAction
		control.destroy()
	})

	test('sends a hold event for each distinct held stage after the press event', () => {
		const { control } = createControl(
			storage({
				down: [action('down1')],
				durations: { 100: [action('held1')], 200: [action('held2')] },
				runWhileHeld: [100, 200],
			})
		)
		const send = vi.fn()

		control.pressControl(true, 'surface1', new ButtonPressEvents(send), false)
		expect(send).toHaveBeenCalledTimes(1)

		vi.advanceTimersByTime(100)
		expect(send).toHaveBeenCalledTimes(2)
		vi.advanceTimersByTime(100)
		expect(send.mock.calls).toEqual([['press'], ['hold'], ['hold']])
		control.destroy()
	})

	test('a replacement press invalidates the previous gesture context', () => {
		const { control } = createControl(storage({ down: [action('down1')] }))
		const firstSend = vi.fn()
		const firstFeedback = new ButtonPressEvents(firstSend)
		const secondSend = vi.fn()

		control.pressControl(true, 'surface1', firstFeedback, false)
		control.pressControl(true, 'surface1', new ButtonPressEvents(secondSend), false)
		firstFeedback.request('held')

		expect(firstSend).toHaveBeenCalledTimes(1)
		expect(secondSend).not.toHaveBeenCalled()
		control.destroy()
	})

	test('explicit cancellation silences later held cues without cancelling their actions', () => {
		const { control, runMultipleActions } = createControl(
			storage({
				down: [action('down1')],
				durations: { 100: [action('held1')] },
				runWhileHeld: [100],
			})
		)
		const send = vi.fn()

		control.pressControl(true, 'surface1', new ButtonPressEvents(send), false)
		control.abortDelayedActions(false, null)
		vi.advanceTimersByTime(100)

		expect(runMultipleActions).toHaveBeenCalledTimes(2)
		expect(send).toHaveBeenCalledTimes(1)
		control.destroy()
	})

	test('destroy invalidates the active gesture context', () => {
		const { control } = createControl(storage({ down: [action('down1')] }))
		const send = vi.fn()
		const feedback = new ButtonPressEvents(send)

		control.pressControl(true, 'surface1', feedback, false)
		control.destroy()
		feedback.request('held')

		expect(send).toHaveBeenCalledTimes(1)
	})

	test('allows an eligible up cue when down had no eligible action', () => {
		const { control } = createControl(storage({ up: [action('up1')] }))
		const send = vi.fn()
		const feedback = new ButtonPressEvents(send)

		control.pressControl(true, 'surface1', feedback, false)
		control.pressControl(false, 'surface1', feedback, false)

		expect(send).toHaveBeenCalledTimes(1)
		control.destroy()
	})

	test('skips feedback when dispatch throws synchronously', () => {
		const { control } = createControl(storage({ down: [action('down1')] }))
		vi.spyOn((control as any).actionRunner, 'runActions').mockImplementation(() => {
			throw new Error('dispatch failed')
		})
		const send = vi.fn()

		expect(() => control.pressControl(true, 'surface1', new ButtonPressEvents(send), false)).toThrow('dispatch failed')
		expect(send).not.toHaveBeenCalled()
		control.destroy()
	})

	test('explicit cancellation during dispatch takes precedence over that gesture cue', () => {
		const { control, runMultipleActions } = createControl(storage({ down: [action('down1')] }))
		runMultipleActions.mockImplementation(async () => control.abortDelayedActions(false, null))
		const send = vi.fn()
		control.pressControl(true, 'surface1', new ButtonPressEvents(send), false)
		expect(runMultipleActions).toHaveBeenCalledTimes(1)
		expect(send).not.toHaveBeenCalled()
		control.destroy()
	})

	test('a synthetic replacement cannot reuse an earlier physical gesture for its release cue', () => {
		const { control } = createControl(storage({ up: [action('up1')] }))
		const send = vi.fn()
		const feedback = new ButtonPressEvents(send)
		control.pressControl(true, 'surface1', feedback, false)
		control.pressControl(true, 'surface1', null, false)
		control.pressControl(false, 'surface1', feedback, false)
		expect(send).not.toHaveBeenCalled()
		control.destroy()
	})
})
