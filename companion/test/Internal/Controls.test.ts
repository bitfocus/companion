import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { EntityModelType, type ActionEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlCommonEvents } from '../../lib/Controls/ControlDependencies.js'
import type { IControlStore } from '../../lib/Controls/IControlStore.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import { InternalControls } from '../../lib/Internal/Controls.js'
import type { ActionForInternalExecution } from '../../lib/Internal/Types.js'
import type { IPageStore } from '../../lib/Page/Store.js'

// Fake timers don't reach node:timers/promises, so route it through the (faked) global setTimeout
vi.mock('node:timers/promises', () => ({
	setTimeout: async <T>(delay: number, value: T, options: { signal?: AbortSignal }) =>
		new Promise<T>((resolve, reject) => {
			const timer = globalThis.setTimeout(() => resolve(value), delay)
			options.signal?.addEventListener('abort', () => {
				globalThis.clearTimeout(timer)
				reject(new Error('aborted'))
			})
		}),
}))

function createControls() {
	const graphicsController = mockDeep<GraphicsController>()
	const controlsStore = mockDeep<IControlStore>()
	const pageStore = mockDeep<IPageStore>()
	const controlEvents = new EventEmitter<ControlCommonEvents>()

	const controls = new InternalControls(graphicsController, controlsStore, pageStore, controlEvents)

	return { controls, controlsStore, pageStore }
}

function makeStoredAction(definitionId: string): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: 'action1',
		definitionId,
		connectionId: 'internal',
		options: { location: exprVal('1/2/3') },
		upgradeIndex: undefined,
	}
}

function makeExecAction(definitionId: string, options: Record<string, unknown>): ActionForInternalExecution {
	return {
		id: 'action1',
		definitionId,
		options: options as any,
		rawEntity: { rawOptions: {} } as any,
	}
}

const fakeExtras: RunActionExtras = {
	controlId: 'ctrl1',
	surfaceId: 'surface0',
	location: undefined,
	abortDelayed: new AbortController().signal,
	executionMode: 'sequential',
	rotationDelta: null,
}

describe('actionUpgrade', () => {
	test('button_rotate_left becomes button_rotate with delta -1', () => {
		const { controls } = createControls()

		const upgraded = controls.actionUpgrade(makeStoredAction('button_rotate_left'), 'ctrl1')

		expect(upgraded).toBeDefined()
		expect(upgraded?.definitionId).toBe('button_rotate')
		expect(upgraded?.options.delta).toEqual({ value: -1, isExpression: false })
		// unrelated options are preserved
		expect(upgraded?.options.location).toEqual(exprVal('1/2/3'))
	})

	test('button_rotate_right becomes button_rotate with delta +1', () => {
		const { controls } = createControls()

		const upgraded = controls.actionUpgrade(makeStoredAction('button_rotate_right'), 'ctrl1')

		expect(upgraded?.definitionId).toBe('button_rotate')
		expect(upgraded?.options.delta).toEqual({ value: 1, isExpression: false })
	})

	test('leaves unrelated actions untouched', () => {
		const { controls } = createControls()

		expect(controls.actionUpgrade(makeStoredAction('button_press'), 'ctrl1')).toBeUndefined()
		expect(controls.actionUpgrade(makeStoredAction('button_rotate'), 'ctrl1')).toBeUndefined()
	})

	test('button_pressrelease gains a zero hold duration, matching the old immediate release', () => {
		const { controls } = createControls()

		const upgraded = controls.actionUpgrade(makeStoredAction('button_pressrelease'), 'ctrl1')

		expect(upgraded?.definitionId).toBe('button_pressrelease')
		expect(upgraded?.options.duration).toEqual({ value: 0, isExpression: false })
		expect(upgraded?.options.location).toEqual(exprVal('1/2/3'))
	})

	test('button_pressrelease with a duration is left untouched', () => {
		const { controls } = createControls()

		const action = makeStoredAction('button_pressrelease')
		action.options.duration = exprVal(500)

		expect(controls.actionUpgrade(action, 'ctrl1')).toBeUndefined()
	})
})

describe('button_pressrelease execution', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('a zero duration presses and releases immediately', () => {
		const { controls, controlsStore, pageStore } = createControls()
		pageStore.getControlIdAt.mockReturnValue('control:target')

		const result = controls.executeAction(
			makeExecAction('button_pressrelease', { location: '1/2/3', force: false, duration: 0 }),
			fakeExtras
		)

		expect(result).toEqual({ result: undefined })
		expect(controlsStore.pressControl.mock.calls).toEqual([
			['control:target', true, 'surface0', false],
			['control:target', false, 'surface0', false],
		])
	})

	test('holds the button for the duration before releasing', async () => {
		const { controls, controlsStore, pageStore } = createControls()
		pageStore.getControlIdAt.mockReturnValue('control:target')

		const result = controls.executeAction(
			makeExecAction('button_pressrelease', { location: '1/2/3', force: true, duration: 500 }),
			fakeExtras
		)

		expect(controlsStore.pressControl.mock.calls).toEqual([['control:target', true, 'surface0', true]])

		await vi.advanceTimersByTimeAsync(499)
		expect(controlsStore.pressControl).toHaveBeenCalledTimes(1)

		await vi.advanceTimersByTimeAsync(1)
		expect(controlsStore.pressControl).toHaveBeenLastCalledWith('control:target', false, 'surface0', true)
		await expect(result).resolves.toEqual({ result: undefined })
	})

	test('releases straight away when the run is aborted mid-hold', async () => {
		const { controls, controlsStore, pageStore } = createControls()
		pageStore.getControlIdAt.mockReturnValue('control:target')

		const abort = new AbortController()
		const result = controls.executeAction(
			makeExecAction('button_pressrelease', { location: '1/2/3', force: false, duration: 5000 }),
			{ ...fakeExtras, abortDelayed: abort.signal }
		)

		abort.abort()
		await expect(result).resolves.toEqual({ result: undefined })
		expect(controlsStore.pressControl.mock.calls).toEqual([
			['control:target', true, 'surface0', false],
			['control:target', false, 'surface0', false],
		])
	})
})

describe('button_rotate execution', () => {
	test('rotates the target control by the signed delta', () => {
		const { controls, controlsStore, pageStore } = createControls()
		pageStore.getControlIdAt.mockReturnValue('control:target')

		void controls.executeAction(makeExecAction('button_rotate', { location: '1/2/3', delta: 5 }), fakeExtras)

		expect(controlsStore.rotateControl).toHaveBeenCalledWith('control:target', 5, 'surface0')
	})

	test('a negative delta rotates the other way', () => {
		const { controls, controlsStore, pageStore } = createControls()
		pageStore.getControlIdAt.mockReturnValue('control:target')

		void controls.executeAction(makeExecAction('button_rotate', { location: '1/2/3', delta: -3 }), fakeExtras)

		expect(controlsStore.rotateControl).toHaveBeenCalledWith('control:target', -3, 'surface0')
	})

	test('a zero or non-numeric delta does nothing', () => {
		const { controls, controlsStore, pageStore } = createControls()
		pageStore.getControlIdAt.mockReturnValue('control:target')

		void controls.executeAction(makeExecAction('button_rotate', { location: '1/2/3', delta: 0 }), fakeExtras)
		void controls.executeAction(makeExecAction('button_rotate', { location: '1/2/3', delta: 'nope' }), fakeExtras)

		expect(controlsStore.rotateControl).not.toHaveBeenCalled()
	})
})
