import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { CompanionOptionValues } from '@companion-module/host'
import { ControlTrigger } from '../../../lib/Controls/ControlTypes/Triggers/Trigger.js'
import { TriggerExecutionSource } from '../../../lib/Controls/ControlTypes/Triggers/TriggerExecutionSource.js'
import { createMockControlDependencies, MockTriggerEventBus, type MockControlDependencies } from './Helpers.js'

const CONTROL_ID = 'trigger:test01'

interface TriggerTestContext extends MockControlDependencies {
	bus: MockTriggerEventBus
	trigger: ControlTrigger
}

function createTrigger(storage: TriggerModel | null = null): TriggerTestContext {
	const mocks = createMockControlDependencies()
	const bus = new MockTriggerEventBus()
	const trigger = new ControlTrigger(mocks.deps, bus.asTriggerEvents(), CONTROL_ID, storage, false)
	vi.runAllTimers() // flush the deferred event setup
	return { ...mocks, bus, trigger }
}

/** Create a trigger with both options.enabled and the parent collection enabled */
function createEnabledTrigger(): TriggerTestContext {
	const context = createTrigger()
	context.trigger.optionsSetField('enabled', true)
	context.trigger.setCollectionEnabled(true)
	vi.runAllTimers()
	context.dbSet.mockClear()
	context.runMultipleActions.mockClear()
	return context
}

let eventCounter = 0
function makeEvent(type: string, options: CompanionOptionValues = {}, enabled = true): EventInstance {
	return { id: `ev${++eventCounter}`, type, enabled, options }
}

describe('ControlTrigger', () => {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
		})
		vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0))
	})
	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	describe('construction', () => {
		test('a new trigger persists the default model', () => {
			const { trigger, dbSet } = createTrigger()

			expect(trigger.type).toBe('trigger')
			expect(dbSet).toHaveBeenCalledWith(CONTROL_ID, {
				type: 'trigger',
				options: ControlTrigger.DefaultOptions,
				actions: [],
				condition: [],
				events: [],
				localVariables: [],
			})
		})

		test('reports itself as disabled on the event bus during setup', () => {
			const mocks = createMockControlDependencies()
			const bus = new MockTriggerEventBus()
			const listener = vi.fn()
			bus.on('trigger_enabled', listener)

			new ControlTrigger(mocks.deps, bus.asTriggerEvents(), CONTROL_ID, null, false)
			vi.runAllTimers()

			expect(listener).toHaveBeenCalledWith(CONTROL_ID, false)
		})

		test('storage of the wrong type throws', () => {
			const mocks = createMockControlDependencies()
			const bus = new MockTriggerEventBus()

			expect(
				() => new ControlTrigger(mocks.deps, bus.asTriggerEvents(), CONTROL_ID, { type: 'button' } as any, false)
			).toThrow(/Invalid type/)
		})

		test('loads options and events from storage without re-saving', () => {
			const storage: TriggerModel = {
				type: 'trigger',
				options: { name: 'My trigger', enabled: true, sortOrder: 3, notes: 'some notes' },
				actions: [],
				condition: [],
				events: [makeEvent('startup', { delay: 0 })],
				localVariables: [],
			}
			const { trigger, dbSet } = createTrigger(storage)

			expect(trigger.options.name).toBe('My trigger')
			expect(trigger.options.enabled).toBe(true)
			expect(trigger.events).toHaveLength(1)
			expect(dbSet).not.toHaveBeenCalled()
		})
	})

	describe('executeActions', () => {
		test('Test source runs the actions even when disabled', () => {
			const { trigger, runMultipleActions } = createTrigger()

			trigger.executeActions(12345, TriggerExecutionSource.Test)

			expect(runMultipleActions).toHaveBeenCalledTimes(1)
			expect(runMultipleActions).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					controlId: CONTROL_ID,
					surfaceId: CONTROL_ID,
					executionMode: 'concurrent',
				})
			)
			// A test execution is not recorded as a real one
			expect(trigger.toTriggerJSON().lastExecuted).toBe(null)
		})

		test('does nothing when the trigger is disabled', () => {
			const { trigger, runMultipleActions } = createTrigger()

			trigger.executeActions(12345, TriggerExecutionSource.Other)

			expect(runMultipleActions).not.toHaveBeenCalled()
			expect(trigger.toTriggerJSON().lastExecuted).toBe(null)
		})

		test('does nothing when enabled but the collection is disabled', () => {
			const { trigger, runMultipleActions } = createTrigger()
			trigger.optionsSetField('enabled', true)
			vi.runAllTimers()

			trigger.executeActions(12345, TriggerExecutionSource.Other)

			expect(runMultipleActions).not.toHaveBeenCalled()
		})

		test('runs and records lastExecuted when fully enabled', () => {
			const { trigger, runMultipleActions } = createEnabledTrigger()

			trigger.executeActions(99999, TriggerExecutionSource.Other)

			expect(runMultipleActions).toHaveBeenCalledTimes(1)
			expect(trigger.toTriggerJSON().lastExecuted).toBe(99999)
		})

		test('a failing condition blocks execution, except for condition-change executions', () => {
			const { trigger, runMultipleActions } = createEnabledTrigger()
			vi.spyOn(trigger.entities, 'checkConditionValue').mockReturnValue(false)

			trigger.executeActions(1, TriggerExecutionSource.Other)
			expect(runMultipleActions).not.toHaveBeenCalled()

			trigger.executeActions(2, TriggerExecutionSource.ConditionChange)
			expect(runMultipleActions).toHaveBeenCalledTimes(1)
		})
	})

	describe('options', () => {
		test('optionsSetField updates and persists the value', () => {
			const { trigger, dbSet } = createTrigger()
			dbSet.mockClear()

			expect(trigger.optionsSetField('name', 'Renamed')).toBe(true)

			expect(trigger.options.name).toBe('Renamed')
			expect(dbSet).toHaveBeenCalledTimes(1)
		})

		test('sortOrder and collectionId are rejected unless forced', () => {
			const { trigger } = createTrigger()

			expect(() => trigger.optionsSetField('sortOrder', 5)).toThrow()
			expect(() => trigger.optionsSetField('collectionId', 'col1')).toThrow()

			expect(trigger.optionsSetField('sortOrder', 5, true)).toBe(true)
			expect(trigger.options.sortOrder).toBe(5)
		})

		test('banned properties are rejected', () => {
			const { trigger } = createTrigger()

			expect(() => trigger.optionsSetField('__proto__', 1)).toThrow(/not allowed/)
		})
	})

	describe('event management', () => {
		test('eventAdd registers a working event', () => {
			const { trigger, bus, dbSet, runMultipleActions } = createEnabledTrigger()

			expect(trigger.eventAdd(makeEvent('startup', { delay: 0 }))).toBe(true)
			expect(trigger.events).toHaveLength(1)
			expect(dbSet).toHaveBeenCalled()

			bus.emit('startup')
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)
		})

		test('a disabled event is not started', () => {
			const { trigger, bus, runMultipleActions } = createEnabledTrigger()

			trigger.eventAdd(makeEvent('startup', { delay: 0 }, false))

			bus.emit('startup')
			vi.runAllTimers()
			expect(runMultipleActions).not.toHaveBeenCalled()
		})

		test('eventEnabled stops and restarts the event', () => {
			const { trigger, bus, runMultipleActions } = createEnabledTrigger()
			const event = makeEvent('startup', { delay: 0 })
			trigger.eventAdd(event)

			expect(trigger.eventEnabled(event.id, false)).toBe(true)
			bus.emit('startup')
			vi.runAllTimers()
			expect(runMultipleActions).not.toHaveBeenCalled()

			expect(trigger.eventEnabled(event.id, true)).toBe(true)
			bus.emit('startup')
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)

			expect(trigger.eventEnabled('unknown', true)).toBe(false)
		})

		test('eventRemove stops the event and removes it from the model', () => {
			const { trigger, bus, runMultipleActions } = createEnabledTrigger()
			const event = makeEvent('startup', { delay: 0 })
			trigger.eventAdd(event)

			expect(trigger.eventRemove(event.id)).toBe(true)
			expect(trigger.events).toHaveLength(0)

			bus.emit('startup')
			vi.runAllTimers()
			expect(runMultipleActions).not.toHaveBeenCalled()

			expect(trigger.eventRemove('unknown')).toBe(false)
		})

		test('eventDuplicate inserts a copy with a new id after the original', () => {
			const { trigger } = createEnabledTrigger()
			const first = makeEvent('startup', { delay: 250 })
			const second = makeEvent('client_connect', { delay: 0 })
			trigger.eventAdd(first)
			trigger.eventAdd(second)

			expect(trigger.eventDuplicate(first.id)).toBe(true)

			expect(trigger.events).toHaveLength(3)
			const copy = trigger.events[1]
			expect(copy.id).not.toBe(first.id)
			expect(copy.type).toBe('startup')
			expect(copy.options).toEqual({ delay: 250 })
			expect(trigger.events[2].id).toBe(second.id)

			expect(trigger.eventDuplicate('unknown')).toBe(false)
		})

		test('eventReorder moves an event', () => {
			const { trigger } = createEnabledTrigger()
			const a = makeEvent('startup', {})
			const b = makeEvent('client_connect', {})
			const c = makeEvent('computer_locked', {})
			trigger.eventAdd(a)
			trigger.eventAdd(b)
			trigger.eventAdd(c)

			expect(trigger.eventReorder(0, 2)).toBe(true)
			expect(trigger.events.map((ev) => ev.id)).toEqual([b.id, c.id, a.id])

			// out of range indices are clamped rather than throwing
			expect(trigger.eventReorder(-5, 100)).toBe(true)
		})

		test('eventSetOptions updates the option and restarts the event', () => {
			const { trigger, bus, runMultipleActions } = createEnabledTrigger()
			const event = makeEvent('startup', { delay: 0 })
			trigger.eventAdd(event)

			expect(trigger.eventSetOptions(event.id, 'delay', 500)).toBe(true)
			expect(trigger.events[0].options.delay).toBe(500)

			bus.emit('startup')
			vi.advanceTimersByTime(499)
			expect(runMultipleActions).not.toHaveBeenCalled()
			vi.advanceTimersByTime(1)
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)

			expect(trigger.eventSetOptions('unknown', 'delay', 1)).toBe(false)
			expect(() => trigger.eventSetOptions(event.id, '__proto__', 1)).toThrow(/not allowed/)
		})

		test('eventHeadline sets the headline', () => {
			const { trigger } = createEnabledTrigger()
			const event = makeEvent('startup', { delay: 0 })
			trigger.eventAdd(event)

			expect(trigger.eventHeadline(event.id, 'My headline')).toBe(true)
			expect(trigger.events[0].headline).toBe('My headline')

			expect(trigger.eventHeadline('unknown', 'nope')).toBe(false)
		})
	})

	describe('toTriggerJSON', () => {
		test('describes enabled events and skips disabled ones', () => {
			const { trigger } = createTrigger()
			trigger.eventAdd(makeEvent('interval', { seconds: 30 }))
			trigger.eventAdd(makeEvent('startup', { delay: 0 }))
			trigger.eventAdd(makeEvent('button_press', {}))
			trigger.eventAdd(makeEvent('variable_changed', { variableId: 'internal:a' }))
			trigger.eventAdd(makeEvent('computer_locked', {}))
			trigger.eventAdd(makeEvent('something_unknown', {}))
			trigger.eventAdd(makeEvent('client_connect', { delay: 0 }, false)) // disabled

			const json = trigger.toTriggerJSON()
			expect(json.description).toBe(
				[
					'Every <strong>30 seconds</strong>',
					'Startup',
					'On any button press',
					'When <strong>$(internal:a)</strong> changes',
					'On computer becoming locked',
					'Unknown event',
				].join('<br />')
			)
		})

		test('reflects the enabled state and collection state', () => {
			const { trigger } = createTrigger()

			expect(trigger.toTriggerJSON()).toMatchObject({
				type: 'trigger',
				enabled: false,
				collectionEnabled: false,
				lastExecuted: null,
			})

			trigger.setCollectionEnabled(true)
			expect(trigger.toTriggerJSON().collectionEnabled).toBe(true)
		})
	})

	describe('client change events', () => {
		test('emits an add followed by update patches', () => {
			const mocks = createMockControlDependencies()
			const bus = new MockTriggerEventBus()
			const listener = vi.fn()
			mocks.deps.changeEvents.on('triggerChange', listener)

			const trigger = new ControlTrigger(mocks.deps, bus.asTriggerEvents(), CONTROL_ID, null, false)
			vi.runAllTimers()

			expect(listener).toHaveBeenCalledWith(
				CONTROL_ID,
				expect.objectContaining({
					type: 'add',
					controlId: CONTROL_ID,
					info: expect.objectContaining({ name: 'New Trigger' }),
				})
			)

			listener.mockClear()
			trigger.optionsSetField('name', 'Renamed')

			expect(listener).toHaveBeenCalledWith(
				CONTROL_ID,
				expect.objectContaining({
					type: 'update',
					controlId: CONTROL_ID,
					patch: expect.arrayContaining([expect.objectContaining({ op: 'replace', path: '/name', value: 'Renamed' })]),
				})
			)
		})
	})

	describe('condition change events', () => {
		test('fires on a false to true transition for condition_true', () => {
			const { trigger, runMultipleActions } = createEnabledTrigger()
			const condition = vi.spyOn(trigger.entities, 'checkConditionValue').mockReturnValue(false)

			trigger.eventAdd(makeEvent('condition_true', {}))
			vi.runAllTimers()
			runMultipleActions.mockClear()

			condition.mockReturnValue(true)
			trigger.triggerRedraw()
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)

			// Staying true does not re-fire
			trigger.triggerRedraw()
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)

			// Falling does not fire a condition_true event
			condition.mockReturnValue(false)
			trigger.triggerRedraw()
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)

			// But the next rise fires again
			condition.mockReturnValue(true)
			trigger.triggerRedraw()
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(2)
		})

		test('fires on a true to false transition for condition_false', () => {
			const { trigger, runMultipleActions } = createEnabledTrigger()
			const condition = vi.spyOn(trigger.entities, 'checkConditionValue').mockReturnValue(true)

			trigger.eventAdd(makeEvent('condition_false', {}))
			vi.runAllTimers()
			runMultipleActions.mockClear()

			condition.mockReturnValue(false)
			trigger.triggerRedraw()
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)
		})

		test('rapid flapping within the debounce window is coalesced', () => {
			const { trigger, runMultipleActions } = createEnabledTrigger()
			const condition = vi.spyOn(trigger.entities, 'checkConditionValue').mockReturnValue(false)

			trigger.eventAdd(makeEvent('condition_true', {}))
			vi.runAllTimers()
			runMultipleActions.mockClear()

			// Many redraw requests in quick succession produce a single recheck
			condition.mockReturnValue(true)
			trigger.triggerRedraw()
			trigger.triggerRedraw()
			trigger.triggerRedraw()
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)
		})

		test('enabling a trigger does not fire on a stale condition edge', () => {
			const { trigger, runMultipleActions } = createTrigger()
			const condition = vi.spyOn(trigger.entities, 'checkConditionValue').mockReturnValue(false)

			trigger.eventAdd(makeEvent('condition_true', {}))
			vi.runAllTimers()

			// The condition becomes true while the trigger is disabled
			condition.mockReturnValue(true)

			trigger.optionsSetField('enabled', true)
			trigger.setCollectionEnabled(true)
			vi.runAllTimers()

			expect(runMultipleActions).not.toHaveBeenCalled()

			// While a real falling and rising edge afterwards still fires
			condition.mockReturnValue(false)
			trigger.triggerRedraw()
			vi.runAllTimers()
			condition.mockReturnValue(true)
			trigger.triggerRedraw()
			vi.runAllTimers()
			expect(runMultipleActions).toHaveBeenCalledTimes(1)
		})

		test('condition events are inert while the collection is disabled', () => {
			const { trigger, runMultipleActions } = createEnabledTrigger()
			const condition = vi.spyOn(trigger.entities, 'checkConditionValue').mockReturnValue(false)

			trigger.eventAdd(makeEvent('condition_true', {}))
			vi.runAllTimers()
			runMultipleActions.mockClear()

			trigger.setCollectionEnabled(false)
			vi.runAllTimers()

			condition.mockReturnValue(true)
			trigger.triggerRedraw()
			vi.runAllTimers()
			expect(runMultipleActions).not.toHaveBeenCalled()
		})
	})

	describe('collections', () => {
		test('checkCollectionIdIsValid keeps a valid collection', () => {
			const storage: TriggerModel = {
				type: 'trigger',
				options: { name: 'My trigger', enabled: true, sortOrder: 0, notes: '', collectionId: 'col1' },
				actions: [],
				condition: [],
				events: [],
				localVariables: [],
			}
			const { trigger } = createTrigger(storage)

			expect(trigger.checkCollectionIdIsValid(new Set(['col1']))).toBe(false)
			expect(trigger.options.collectionId).toBe('col1')
		})

		test('checkCollectionIdIsValid clears an invalid collection and enables the trigger', () => {
			const storage: TriggerModel = {
				type: 'trigger',
				options: { name: 'My trigger', enabled: true, sortOrder: 0, notes: '', collectionId: 'col1' },
				actions: [],
				condition: [],
				events: [],
				localVariables: [],
			}
			const { trigger } = createTrigger(storage)

			expect(trigger.checkCollectionIdIsValid(new Set())).toBe(true)
			expect(trigger.options.collectionId).toBe(undefined)
			expect(trigger.toTriggerJSON().collectionEnabled).toBe(true)
		})
	})

	describe('destroy', () => {
		test('stops events, reports disabled, and informs clients', () => {
			const { trigger, bus, runMultipleActions, deps } = createEnabledTrigger()
			trigger.eventAdd(makeEvent('startup', { delay: 0 }))

			const changeListener = vi.fn()
			deps.changeEvents.on('triggerChange', changeListener)
			const enabledListener = vi.fn()
			bus.on('trigger_enabled', enabledListener)

			trigger.destroy()
			vi.runAllTimers()

			expect(enabledListener).toHaveBeenCalledWith(CONTROL_ID, false)
			expect(changeListener).toHaveBeenCalledWith(CONTROL_ID, { type: 'remove', controlId: CONTROL_ID })

			bus.emit('startup')
			bus.emitTick(1000, 1000_000)
			vi.runAllTimers()
			expect(runMultipleActions).not.toHaveBeenCalled()
		})
	})
})
