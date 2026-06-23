import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntityModelType, type FeedbackEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import type { InstanceController } from '../../lib/Instance/Controller.js'
import type { ActionForInternalExecution } from '../../lib/Internal/Types.js'
import { InternalInstance } from '../../lib/Internal/Instance.js'

// ---- helpers ----------------------------------------------------------------

// InternalInstance schedules debounced timers (checkFeedbacks / regenerateVariables) on status
// changes that would otherwise outlive the test and race vitest's worker teardown.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

function createInstance(): InternalInstance {
	const instanceController = {
		status: { on: vi.fn() },
		on: vi.fn(),
	} as unknown as InstanceController

	return new InternalInstance(instanceController)
}

interface HarnessOptions {
	connectionIds?: string[]
	labels?: Record<string, string | undefined>
	statuses?: Record<string, InstanceStatusEntry | undefined>
	configs?: Record<string, { enabled: boolean; label: string } | undefined>
	collectionEnabled?: boolean
}

/**
 * A richer harness that captures the `status_change` listener so tests can drive the private
 * `#calculateInstanceErrors` count logic, and exposes mocked controller methods to assert against.
 */
function createHarness(opts: HarnessOptions = {}) {
	let statusChangeHandler: ((statuses: Record<string, InstanceStatusEntry | undefined>) => void) | undefined

	const controller = {
		status: {
			on: vi.fn((event: string, handler: any) => {
				if (event === 'status_change') statusChangeHandler = handler
			}),
		},
		on: vi.fn(),
		getAllConnectionIds: vi.fn(() => opts.connectionIds ?? []),
		getLabelForConnection: vi.fn((id: string) => opts.labels?.[id]),
		getInstanceStatus: vi.fn((id: string) => opts.statuses?.[id]),
		getInstanceConfigOfType: vi.fn((id: string) => opts.configs?.[id]),
		enableDisableConnection: vi.fn(),
		connectionCollections: {
			setCollectionEnabled: vi.fn(),
			isCollectionEnabled: vi.fn(() => opts.collectionEnabled ?? false),
		},
	}

	const internal = new InternalInstance(controller as unknown as InstanceController)

	return {
		internal,
		controller,
		fireStatusChange: (statuses: Record<string, InstanceStatusEntry | undefined>) => {
			if (!statusChangeHandler) throw new Error('status_change handler was not registered')
			statusChangeHandler(statuses)
		},
	}
}

const fakeExtras: RunActionExtras = {
	controlId: 'ctrl1',
	surfaceId: undefined,
	location: undefined,
	abortDelayed: new AbortController().signal,
	executionMode: 'sequential',
}

function makeAction(definitionId: string, options: Record<string, unknown>): ActionForInternalExecution {
	return {
		id: 'action1',
		definitionId,
		options: options as any,
		rawEntity: { rawOptions: {} } as any,
	}
}

function makeExecFeedback(definitionId: string, options: Record<string, unknown>) {
	return {
		controlId: 'ctrl1',
		location: undefined,
		id: 'fb1',
		definitionId,
		options: options as any,
	}
}

const STATUS_COLORS = {
	ok_fg: 1,
	ok_bg: 2,
	warning_fg: 3,
	warning_bg: 4,
	error_fg: 5,
	error_bg: 6,
	disabled_fg: 7,
	disabled_bg: 8,
}

function makeFeedback(definitionId: string, options: Record<string, unknown>): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: 'fb1',
		definitionId,
		connectionId: 'internal',
		options,
		upgradeIndex: undefined,
	} as FeedbackEntityModel
}

// ---- tests ------------------------------------------------------------------

describe('InternalInstance', () => {
	describe('instance_custom_state definition', () => {
		it("offers a selectable 'Disabled' choice with a non-null id", () => {
			const internal = createInstance()
			const definition = internal.getFeedbackDefinitions()['instance_custom_state']

			const stateOption = definition.options.find((o) => o.id === 'state') as any
			const disabledChoice = stateOption.choices.find((c: any) => c.label === 'Disabled')

			expect(disabledChoice.id).toBe('null')
			// A null id cannot be represented/selected by the UI dropdown
			expect(disabledChoice.id).not.toBeNull()
		})
	})

	describe('feedbackUpgrade', () => {
		it("migrates a null instance_custom_state to the string 'null'", () => {
			const internal = createInstance()
			const feedback = makeFeedback('instance_custom_state', { state: exprVal(null), instance_id: exprVal('abc') })

			const result = internal.feedbackUpgrade(feedback, 'ctrl1')

			expect(result).toBeTruthy()
			expect(feedback.options.state).toEqual(exprVal('null'))
		})

		it('leaves a non-null instance_custom_state state untouched', () => {
			const internal = createInstance()
			const feedback = makeFeedback('instance_custom_state', { state: exprVal('good'), instance_id: exprVal('abc') })

			const result = internal.feedbackUpgrade(feedback, 'ctrl1')

			expect(result).toBeUndefined()
			expect(feedback.options.state).toEqual(exprVal('good'))
		})

		it('ignores other feedback types', () => {
			const internal = createInstance()
			const feedback = makeFeedback('instance_status', { state: exprVal(null) })

			const result = internal.feedbackUpgrade(feedback, 'ctrl1')

			expect(result).toBeUndefined()
		})
	})

	describe('executeAction - instance_control', () => {
		it('enables a connection when set to true', () => {
			const { internal, controller } = createHarness()

			internal.executeAction(makeAction('instance_control', { instance_id: 'conn1', enable: 'true' }), fakeExtras)

			expect(controller.enableDisableConnection).toHaveBeenCalledWith('conn1', true)
		})

		it('disables a connection when set to false', () => {
			const { internal, controller } = createHarness()

			internal.executeAction(makeAction('instance_control', { instance_id: 'conn1', enable: 'false' }), fakeExtras)

			expect(controller.enableDisableConnection).toHaveBeenCalledWith('conn1', false)
		})

		it('toggles based on the current status (running -> disable)', () => {
			const { internal, controller } = createHarness({
				statuses: { conn1: { category: 'good' } as InstanceStatusEntry },
			})

			internal.executeAction(makeAction('instance_control', { instance_id: 'conn1', enable: 'toggle' }), fakeExtras)

			expect(controller.enableDisableConnection).toHaveBeenCalledWith('conn1', false)
		})

		it('toggles based on the current status (stopped -> enable)', () => {
			const { internal, controller } = createHarness({
				statuses: { conn1: { category: null } as InstanceStatusEntry },
			})

			internal.executeAction(makeAction('instance_control', { instance_id: 'conn1', enable: 'toggle' }), fakeExtras)

			expect(controller.enableDisableConnection).toHaveBeenCalledWith('conn1', true)
		})

		it('does nothing when no connection is selected', () => {
			const { internal, controller } = createHarness()

			internal.executeAction(makeAction('instance_control', { instance_id: '', enable: 'true' }), fakeExtras)

			expect(controller.enableDisableConnection).not.toHaveBeenCalled()
		})
	})

	describe('executeAction - connection_collection_enabled', () => {
		it('enables a collection when set to true', () => {
			const { internal, controller } = createHarness()

			internal.executeAction(
				makeAction('connection_collection_enabled', { collection_id: 'col1', enable: 'true' }),
				fakeExtras
			)

			expect(controller.connectionCollections.setCollectionEnabled).toHaveBeenCalledWith('col1', true)
		})

		it('passes through the toggle sentinel', () => {
			const { internal, controller } = createHarness()

			internal.executeAction(
				makeAction('connection_collection_enabled', { collection_id: 'col1', enable: 'toggle' }),
				fakeExtras
			)

			expect(controller.connectionCollections.setCollectionEnabled).toHaveBeenCalledWith('col1', 'toggle')
		})

		it('does nothing when no collection is selected', () => {
			const { internal, controller } = createHarness()

			internal.executeAction(
				makeAction('connection_collection_enabled', { collection_id: '', enable: 'true' }),
				fakeExtras
			)

			expect(controller.connectionCollections.setCollectionEnabled).not.toHaveBeenCalled()
		})
	})

	describe('executeAction - unknown', () => {
		it('returns null for an unrecognised action', () => {
			const { internal } = createHarness()

			expect(internal.executeAction(makeAction('not_a_real_action', {}), fakeExtras)).toBeNull()
		})
	})

	describe('executeFeedback - instance_status (all)', () => {
		it('returns error colors when any connection is in error', () => {
			const { internal, fireStatusChange } = createHarness({
				connectionIds: ['c1'],
				configs: { c1: { enabled: true, label: 'C1' } },
			})
			fireStatusChange({ c1: { category: 'error' } as InstanceStatusEntry })

			const result = internal.executeFeedback(makeExecFeedback('instance_status', { instance_id: 'all', ...STATUS_COLORS }))

			expect(result).toEqual({ color: STATUS_COLORS.error_fg, bgcolor: STATUS_COLORS.error_bg })
		})

		it('returns warning colors when a connection is in warning (and none in error)', () => {
			const { internal, fireStatusChange } = createHarness({
				connectionIds: ['c1'],
				configs: { c1: { enabled: true, label: 'C1' } },
			})
			fireStatusChange({ c1: { category: 'warning' } as InstanceStatusEntry })

			const result = internal.executeFeedback(makeExecFeedback('instance_status', { instance_id: 'all', ...STATUS_COLORS }))

			expect(result).toEqual({ color: STATUS_COLORS.warning_fg, bgcolor: STATUS_COLORS.warning_bg })
		})

		it('returns ok colors when everything is healthy', () => {
			const { internal, fireStatusChange } = createHarness({
				connectionIds: ['c1'],
				configs: { c1: { enabled: true, label: 'C1' } },
			})
			fireStatusChange({ c1: { category: 'good' } as InstanceStatusEntry })

			const result = internal.executeFeedback(makeExecFeedback('instance_status', { instance_id: 'all', ...STATUS_COLORS }))

			expect(result).toEqual({ color: STATUS_COLORS.ok_fg, bgcolor: STATUS_COLORS.ok_bg })
		})
	})

	describe('executeFeedback - instance_status (specific)', () => {
		it.each([
			['error', { color: STATUS_COLORS.error_fg, bgcolor: STATUS_COLORS.error_bg }],
			['warning', { color: STATUS_COLORS.warning_fg, bgcolor: STATUS_COLORS.warning_bg }],
			['good', { color: STATUS_COLORS.ok_fg, bgcolor: STATUS_COLORS.ok_bg }],
		])('maps the %s status to its colors', (category, expected) => {
			const { internal } = createHarness({
				statuses: { c1: { category } as InstanceStatusEntry },
			})

			const result = internal.executeFeedback(makeExecFeedback('instance_status', { instance_id: 'c1', ...STATUS_COLORS }))

			expect(result).toEqual(expected)
		})

		it('returns disabled colors when the connection has no status entry', () => {
			const { internal } = createHarness({ statuses: {} })

			const result = internal.executeFeedback(makeExecFeedback('instance_status', { instance_id: 'c1', ...STATUS_COLORS }))

			expect(result).toEqual({ color: STATUS_COLORS.disabled_fg, bgcolor: STATUS_COLORS.disabled_bg })
		})
	})

	describe('executeFeedback - instance_custom_state', () => {
		it('returns true when the cached status matches the requested state', () => {
			const { internal, fireStatusChange } = createHarness({
				connectionIds: ['c1'],
				configs: { c1: { enabled: true, label: 'C1' } },
			})
			fireStatusChange({ c1: { category: 'warning' } as InstanceStatusEntry })

			expect(internal.executeFeedback(makeExecFeedback('instance_custom_state', { instance_id: 'c1', state: 'warning' }))).toBe(true)
			expect(internal.executeFeedback(makeExecFeedback('instance_custom_state', { instance_id: 'c1', state: 'good' }))).toBe(false)
		})

		it("treats a missing status as 'null' (disabled)", () => {
			const { internal } = createHarness()

			expect(internal.executeFeedback(makeExecFeedback('instance_custom_state', { instance_id: 'c1', state: 'null' }))).toBe(true)
		})

		it('returns false when no connection is selected', () => {
			const { internal } = createHarness()

			expect(internal.executeFeedback(makeExecFeedback('instance_custom_state', { instance_id: '', state: 'good' }))).toBe(false)
		})
	})

	describe('executeFeedback - connection_collection_enabled', () => {
		it('returns true when the collection state matches the target', () => {
			const { internal } = createHarness({ collectionEnabled: true })

			expect(
				internal.executeFeedback(makeExecFeedback('connection_collection_enabled', { collection_id: 'col1', enable: 'true' }))
			).toBe(true)
			expect(
				internal.executeFeedback(makeExecFeedback('connection_collection_enabled', { collection_id: 'col1', enable: 'false' }))
			).toBe(false)
		})

		it('returns false when no collection is selected', () => {
			const { internal } = createHarness()

			expect(
				internal.executeFeedback(makeExecFeedback('connection_collection_enabled', { collection_id: '', enable: 'true' }))
			).toBe(false)
		})
	})

	describe('getVariableDefinitions', () => {
		it('returns the base counts plus a per-connection status variable', () => {
			const { internal } = createHarness({
				connectionIds: ['c1'],
				labels: { c1: 'My Device' },
			})

			const names = internal.getVariableDefinitions().map((v) => v.name)

			expect(names).toEqual(
				expect.arrayContaining([
					'instance_total',
					'instance_disabled',
					'instance_errors',
					'instance_warns',
					'instance_oks',
					'connection_My Device_status',
				])
			)
		})
	})

	describe('status counts via updateVariables', () => {
		it('emits the calculated counts and per-connection status', () => {
			const { internal, fireStatusChange } = createHarness({
				connectionIds: ['c1', 'c2', 'c3'],
				configs: {
					c1: { enabled: true, label: 'C1' },
					c2: { enabled: true, label: 'C2' },
					c3: { enabled: false, label: 'C3' },
				},
			})

			const setVariables = vi.fn()
			internal.on('setVariables', setVariables)

			fireStatusChange({
				c1: { category: 'good' } as InstanceStatusEntry,
				c2: { category: 'error' } as InstanceStatusEntry,
				c3: { category: 'good' } as InstanceStatusEntry, // config disabled -> counts as disabled
			})

			expect(setVariables).toHaveBeenCalled()
			const values = setVariables.mock.calls.at(-1)![0]
			expect(values).toMatchObject({
				instance_total: 3,
				instance_oks: 1,
				instance_errors: 1,
				instance_disabled: 1,
				instance_warns: 0,
			})
			expect(values['connection_C3_status']).toBe('disabled')
			expect(values['connection_C2_status']).toBe('error')
		})
	})

	describe('visitReferences', () => {
		it('visits connection ids on instance_control actions and status feedbacks', () => {
			const { internal } = createHarness()
			const visitor = { visitConnectionId: vi.fn() } as any

			const action = { id: 'a1', action: 'instance_control', options: { instance_id: exprVal('conn1') } } as any
			const customState = { id: 'fb1', type: 'instance_custom_state', options: { instance_id: exprVal('conn1') } } as any
			const statusAll = { id: 'fb2', type: 'instance_status', options: { instance_id: exprVal('all') } } as any
			const statusSpecific = { id: 'fb3', type: 'instance_status', options: { instance_id: exprVal('conn2') } } as any

			internal.visitReferences(visitor, [action], [customState, statusAll, statusSpecific])

			expect(visitor.visitConnectionId).toHaveBeenCalledWith(action.options, 'instance_id')
			expect(visitor.visitConnectionId).toHaveBeenCalledWith(customState.options, 'instance_id', 'fb1')
			expect(visitor.visitConnectionId).toHaveBeenCalledWith(statusSpecific.options, 'instance_id', 'fb3')
			// 'all' status feedbacks are not visited
			expect(visitor.visitConnectionId).not.toHaveBeenCalledWith(statusAll.options, 'instance_id', 'fb2')
		})
	})
})
