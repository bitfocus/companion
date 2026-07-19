import { EventEmitter } from 'node:events'
import { vi, type Mock } from 'vitest'
import type { ControlDependencies } from '../../../lib/Controls/ControlDependencies.js'
import type { TriggerEvents } from '../../../lib/Controls/TriggerEvents.js'
import { mockUserConfig } from '../../utils/MockUserConfig.js'

/**
 * A stand-in for the TriggerEvents bus, which allows tests to emit ticks
 * (and the other bus events) with full control over the timestamps,
 * instead of waiting for the real 1-second interval.
 */
export class MockTriggerEventBus extends EventEmitter<any> {
	#lastTick = 0

	getLastTickTime(): number {
		return this.#lastTick
	}

	setLastTickTime(tickSeconds: number): void {
		this.#lastTick = tickSeconds
	}

	emitTick(tickSeconds: number, nowTime: number): void {
		this.#lastTick = tickSeconds
		this.emit('tick', tickSeconds, nowTime)
	}

	asTriggerEvents(): TriggerEvents {
		return this as unknown as TriggerEvents
	}
}

export interface MockControlDependencies {
	deps: ControlDependencies
	bus: MockTriggerEventBus
	dbSet: Mock
	runMultipleActions: Mock
}

/**
 * Create a minimal mock of ControlDependencies, suitable for constructing a ControlTrigger.
 * Only the pieces the trigger actually touches are real; the rest are nulls.
 */
export function createMockControlDependencies(): MockControlDependencies {
	const dbSet = vi.fn()
	const runMultipleActions = vi.fn().mockResolvedValue(undefined)
	const bus = new MockTriggerEventBus()

	const deps: ControlDependencies = {
		surfaces: null as any,
		pageStore: null as any,
		getPageVariableEntities: () => null,
		triggerEvents: bus.asTriggerEvents(),
		expressionVariableNamesMap: null as any,
		internalModule: null as any,
		instance: {
			definitions: null as any,
			processManager: null as any,
		} as any,
		variableValues: null as any,
		userconfig: mockUserConfig({ timezone: '' }),
		graphics: null as any,
		actionRunner: {
			runMultipleActions,
		} as any,
		dbTable: {
			set: dbSet,
			delete: vi.fn(),
		} as any,
		events: new EventEmitter() as any,
		changeEvents: new EventEmitter() as any,
	}

	return { deps, bus, dbSet, runMultipleActions }
}
