import { describe, expect, test, vi } from 'vitest'
import { CreateBankControlId } from '@companion-app/shared/ControlId.js'
import {
	VariableDependencyRegistry,
	type VariableDependency,
	type VariableDependencyListener,
} from '../../lib/Variables/DependencyRegistry.js'

const C1 = CreateBankControlId('c1')
const C2 = CreateBankControlId('c2')
const C3 = CreateBankControlId('c3')

function createListener<T = string>() {
	const calls: Array<{ hits: T[]; changed: string[] }> = []
	const listener: VariableDependencyListener<T> = {
		onVariableDependenciesChanged: vi.fn((hits: ReadonlyArray<VariableDependency<T>>, changed: ReadonlySet<string>) => {
			calls.push({ hits: hits.map((h) => h.data), changed: Array.from(changed) })
		}),
	}
	return { listener, calls }
}

describe('VariableDependencyRegistry', () => {
	test('notifies only the dependencies referencing a changed variable', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		registry.create(listener, C1, 'a').set(new Set(['conn:x', 'conn:y']))
		registry.create(listener, C2, 'b').set(new Set(['conn:y']))
		registry.create(listener, C3, 'c').set(new Set(['conn:z']))

		registry.dispatch(new Set(['conn:x']), null)
		registry.dispatch(new Set(['conn:y', 'conn:x']), null)
		registry.dispatch(new Set(['conn:other']), null)

		expect(calls).toEqual([
			{ hits: ['a'], changed: ['conn:x'] },
			{ hits: ['a', 'b'], changed: ['conn:y', 'conn:x'] },
		])
	})

	test('calls each listener once per change, with all its hits', () => {
		const registry = new VariableDependencyRegistry()
		const first = createListener()
		const second = createListener()

		registry.create(first.listener, C1, 'a').set(new Set(['conn:x']))
		registry.create(first.listener, C1, 'b').set(new Set(['conn:x']))
		registry.create(second.listener, C2, 'c').set(new Set(['conn:x']))

		registry.dispatch(new Set(['conn:x']), null)

		expect(first.calls).toEqual([{ hits: ['a', 'b'], changed: ['conn:x'] }])
		expect(second.calls).toEqual([{ hits: ['c'], changed: ['conn:x'] }])
	})

	test('a scoped change only reaches the targeted controls', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		registry.create(listener, C1, 'a').set(new Set(['conn:x']))
		registry.create(listener, C2, 'b').set(new Set(['conn:x']))

		registry.dispatch(new Set(['conn:x']), new Set([C2]))

		expect(calls).toEqual([{ hits: ['b'], changed: ['conn:x'] }])
	})

	test('control-relative variables are tracked per control', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		registry.create(listener, C1, 'a').set(new Set(['local:x', 'this:page']))
		registry.create(listener, C2, 'b').set(new Set(['local:x', 'page:y']))

		registry.dispatch(new Set(['local:x']), new Set([C1]))
		registry.dispatch(new Set(['page:y']), new Set([C1, C2]))
		registry.dispatch(new Set(['this:page']), new Set([C2]))

		expect(calls).toEqual([
			{ hits: ['a'], changed: ['local:x'] },
			{ hits: ['b'], changed: ['page:y'] },
		])

		// They can't be changed globally
		registry.dispatch(new Set(['local:x']), null)
		expect(calls).toHaveLength(2)
	})

	test('set replaces the variables', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		const dep = registry.create(listener, C1, 'a')
		dep.set(new Set(['conn:x']))
		dep.set(new Set(['conn:y']))

		registry.dispatch(new Set(['conn:x']), null)
		expect(calls).toHaveLength(0)

		registry.dispatch(new Set(['conn:y']), null)
		expect(calls).toHaveLength(1)

		dep.set(null)
		registry.dispatch(new Set(['conn:y']), null)
		expect(calls).toHaveLength(1)
		expect(registry.stats().keys).toBe(0)
	})

	test('set with equal contents keeps the new set and leaves the index alone', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		const dep = registry.create(listener, C1, 'a')
		dep.set(new Set(['conn:x', 'conn:y']))
		const replacement = new Set(['conn:y', 'conn:x'])
		dep.set(replacement)

		expect(dep.variableIds).toBe(replacement)
		registry.dispatch(new Set(['conn:x']), null)
		expect(calls).toHaveLength(1)
		expect(registry.stats().keys).toBe(2)
	})

	test('an armed dependency receives every change for its control until set', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		const dep = registry.create(listener, C1, 'a')
		dep.arm()

		registry.dispatch(new Set(['conn:anything']), null)
		registry.dispatch(new Set(['local:x']), new Set([C1]))
		registry.dispatch(new Set(['local:x']), new Set([C2]))
		expect(calls.map((c) => c.changed)).toEqual([['conn:anything'], ['local:x']])

		dep.set(new Set(['conn:x']))
		registry.dispatch(new Set(['conn:anything']), null)
		expect(calls).toHaveLength(2)
		expect(registry.stats().armed).toBe(0)
	})

	test('disarm ends an arm without changing the variables', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		const dep = registry.create(listener, C1, 'a')
		dep.set(new Set(['conn:x']))
		dep.arm()
		dep.disarm()

		registry.dispatch(new Set(['conn:other']), null)
		registry.dispatch(new Set(['conn:x']), null)
		expect(calls.map((c) => c.changed)).toEqual([['conn:x']])
	})

	test('an armed dependency referencing a changed variable is only notified once', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		const dep = registry.create(listener, C1, 'a')
		dep.set(new Set(['conn:x']))
		dep.arm()

		registry.dispatch(new Set(['conn:x']), null)
		expect(calls).toEqual([{ hits: ['a'], changed: ['conn:x'] }])
	})

	test('dispose stops notifications and cleans up', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		const dep = registry.create(listener, C1, 'a')
		dep.set(new Set(['conn:x', 'local:y']))
		dep.arm()
		dep.dispose()
		dep.dispose()

		registry.dispatch(new Set(['conn:x']), null)
		expect(calls).toHaveLength(0)
		expect(registry.stats()).toEqual({ keys: 0, controls: 0, dependencies: 0, armed: 0 })

		// Using it afterwards is ignored
		dep.set(new Set(['conn:x']))
		dep.arm()
		expect(registry.stats()).toEqual({ keys: 0, controls: 0, dependencies: 0, armed: 0 })
	})

	test('disposeControl disposes every dependency of that control', () => {
		const registry = new VariableDependencyRegistry()
		const { listener, calls } = createListener()

		const a = registry.create(listener, C1, 'a')
		a.set(new Set(['conn:x']))
		registry.create(listener, C1, 'b').set(new Set(['local:x']))
		registry.create(listener, C2, 'c').set(new Set(['conn:x']))

		registry.disposeControl(C1)

		expect(a.isDisposed).toBe(true)
		registry.dispatch(new Set(['conn:x']), null)
		expect(calls).toEqual([{ hits: ['c'], changed: ['conn:x'] }])
		expect(registry.stats()).toEqual({ keys: 1, controls: 1, dependencies: 1, armed: 0 })
	})

	test('does not deliver hits disposed by an earlier listener in the same change', () => {
		const registry = new VariableDependencyRegistry()
		const second = createListener()
		const victim = registry.create(second.listener, C2, 'victim')

		const first: VariableDependencyListener<string> = {
			onVariableDependenciesChanged: () => victim.dispose(),
		}
		registry.create(first, C1, 'a').set(new Set(['conn:x']))
		victim.set(new Set(['conn:x']))

		registry.dispatch(new Set(['conn:x']), null)
		expect(second.calls).toHaveLength(0)
	})

	test('a throwing listener does not stop the others', () => {
		const registry = new VariableDependencyRegistry()
		const second = createListener()

		registry
			.create<string>(
				{
					onVariableDependenciesChanged: () => {
						throw new Error('boom')
					},
				},
				C1,
				'a'
			)
			.set(new Set(['conn:x']))
		registry.create(second.listener, C2, 'b').set(new Set(['conn:x']))

		registry.dispatch(new Set(['conn:x']), null)
		expect(second.calls).toHaveLength(1)
	})

	test('a listener may dispatch again (re-entrantly) without disturbing the outer change', () => {
		const registry = new VariableDependencyRegistry()
		const inner = createListener()
		registry.create(inner.listener, C2, 'inner').set(new Set(['conn:y']))

		const outerCalls: string[][] = []
		const outer: VariableDependencyListener<string> = {
			onVariableDependenciesChanged: (_hits, changed) => {
				outerCalls.push(Array.from(changed))
				if (changed.has('conn:x')) registry.dispatch(new Set(['conn:y']), null)
			},
		}
		registry.create(outer, C1, 'a').set(new Set(['conn:x']))
		registry.create(inner.listener, C3, 'also-inner').set(new Set(['conn:x']))

		registry.dispatch(new Set(['conn:x']), null)

		expect(outerCalls).toEqual([['conn:x']])
		expect(inner.calls).toEqual([
			{ hits: ['inner'], changed: ['conn:y'] },
			{ hits: ['also-inner'], changed: ['conn:x'] },
		])
	})
})
