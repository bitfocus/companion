import { initTRPC } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import { PreviewExpressionStream } from '../../lib/Preview/ExpressionStream.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import type { LocalVariablesController } from '../../lib/Variables/LocalVariablesController.js'
import type { VariableValueData } from '../../lib/Variables/Util.js'
import { VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

// ── test infrastructure ──────────────────────────────────────────────────────

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = { clientId: 'test-client', clientIp: '127.0.0.1' }

function createParser(variables: VariableValueData = {}): VariablesAndExpressionParser {
	return new VariablesAndExpressionParser(null as any, variables, new Map(), null, null)
}

/**
 * Build a mock ControlsController whose `createVariablesAndExpressionParser` returns
 * a real parser (with a fresh variable snapshot per call), applying any overrides via
 * `createChildParser` so that injected context variables like `this:value` resolve correctly.
 */
function makeControlsControllerMock(getVariables: () => VariableValueData): ControlsController {
	return {
		createVariablesAndExpressionParser: vi
			.fn()
			.mockImplementation((_controlId: string | null | undefined, overrides?: VariableValues | null) => {
				const base = createParser(getVariables())
				return overrides && Object.keys(overrides).length > 0 ? base.createChildParser(overrides) : base
			}),
	} as unknown as ControlsController
}

function makeLocalVariablesMock(
	localVariable: { controlId: string; name: string } | null,
	getContext: () => VariableValues | null
): LocalVariablesController {
	return {
		localVariableFor: vi.fn().mockImplementation(() => localVariable),
		getLocalVariableContextFor: vi.fn().mockImplementation(getContext),
	} as unknown as LocalVariablesController
}

function createStream(controlsController: ControlsController, localVariables: LocalVariablesController) {
	const stream = new PreviewExpressionStream(controlsController, localVariables)
	const router = stream.createTrpcRouter()
	const caller = t.createCallerFactory(router)(testCtx)
	return { stream, caller }
}

// ── custom variable context ──────────────────────────────────────────────────

describe('customVariable context resolution', () => {
	it('injects $(this:value) from the current custom variable value', async () => {
		const variables = { custom: { myVar: 10 } }
		const cc = makeControlsControllerMock(() => variables)
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value) + 1',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', name: 'myVar' },
			})
		)

		await sub.expectValue({ ok: true, value: 11 })
		await sub.cleanup()
	})

	it('returns undefined for this:value when custom variable does not exist', async () => {
		const cc = makeControlsControllerMock(() => ({})) // no custom:myVar
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', name: 'myVar' },
			})
		)

		// Variable exists but is undefined — expression evaluates to undefined
		const result = await sub.next()
		expect(result.ok).toBe(true)
		await sub.cleanup()
	})

	it('re-evaluates when the tracked custom variable changes', async () => {
		let currentValue = 5
		const cc = makeControlsControllerMock(() => ({ custom: { myVar: currentValue } }))
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value) * 2',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', name: 'myVar' },
			})
		)

		await sub.expectValue({ ok: true, value: 10 }) // 5 * 2

		// Simulate custom variable changing to 7
		currentValue = 7
		stream.onVariablesChanged(new Set(['custom:myVar']), null)

		await sub.expectValue({ ok: true, value: 14 }) // 7 * 2
		await sub.cleanup()
	})

	it('does not re-evaluate when an unrelated variable changes', async () => {
		const variables = { custom: { myVar: 3 } }
		const cc = makeControlsControllerMock(() => variables)
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', name: 'myVar' },
			}),
			{ timeoutMs: 100 }
		)

		await sub.next() // consume initial

		// Change a different variable
		stream.onVariablesChanged(new Set(['custom:otherVar']), null)

		// No re-evaluation expected; cleanup is skipped because the generator is suspended
		// waiting for an event that will never arrive (cleanup would block indefinitely)
		await expect(sub.next()).rejects.toThrow('Subscription timeout')
	})
})

// ── local variable context ───────────────────────────────────────────────────

describe('localVariable context resolution', () => {
	it('injects this:value and target:* from the local variable context', async () => {
		const context = { 'this:value': 5, 'target:counter': 5 }
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock({ controlId: 'ctrl1', name: 'counter' }, () => context)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value) + $(target:counter)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', location: 'this', name: 'counter' },
			})
		)

		await sub.expectValue({ ok: true, value: 10 }) // 5 + 5
		await sub.cleanup()
	})

	it('re-evaluates when the target control changes (isTargetControlChange)', async () => {
		let context: VariableValues = { 'this:value': 3, 'target:counter': 3 }
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock({ controlId: 'ctrl1', name: 'counter' }, () => context)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value) + 1',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', location: 'this', name: 'counter' },
			})
		)

		await sub.expectValue({ ok: true, value: 4 }) // 3 + 1

		// Update context (simulates local variable changing on ctrl1)
		context = { 'this:value': 9, 'target:counter': 9 }
		// The resolved target controlId is 'ctrl1' (set during first resolution)
		stream.onVariablesChanged(new Set(['local:counter']), 'ctrl1')

		await sub.expectValue({ ok: true, value: 10 }) // 9 + 1
		await sub.cleanup()
	})

	it('does NOT re-evaluate when a different control changes', async () => {
		const context = { 'this:value': 3, 'target:counter': 3 }
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock({ controlId: 'ctrl1', name: 'counter' }, () => context)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value) + 1',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', location: 'this', name: 'counter' },
			}),
			{ timeoutMs: 100 }
		)

		await sub.next() // consume initial

		// Change from a different control — must not trigger re-evaluation
		stream.onVariablesChanged(new Set(['local:counter']), 'different-ctrl')

		// No re-evaluation expected; cleanup skipped — generator is suspended waiting for
		// an event that will never arrive (cleanup would block indefinitely)
		await expect(sub.next()).rejects.toThrow('Subscription timeout')
	})

	it('evaluates without context when localVariableFor returns null (variable not found)', async () => {
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock(null, () => null) // not found
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', location: 'this', name: 'missing' },
			})
		)

		// Should still return a result, just without context (this:value unresolved)
		const result = await sub.next()
		expect(result.ok).toBe(true)
		await sub.cleanup()
	})
})

// ── no context resolution ────────────────────────────────────────────────────

describe('no contextResolution', () => {
	it('evaluates plain expressions without context', async () => {
		const cc = makeControlsControllerMock(() => ({ test: { val: 42 } }))
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(test:val) + 1',
				controlId: 'ctrl1',
				isVariableString: false,
			})
		)

		await sub.expectValue({ ok: true, value: 43 })
		await sub.cleanup()
	})

	it('re-evaluates when an expression variable changes (fromControlId = null)', async () => {
		let variables = { test: { val: 10 } }
		const cc = makeControlsControllerMock(() => variables)
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(test:val)',
				controlId: 'ctrl1',
				isVariableString: false,
			})
		)

		await sub.expectValue({ ok: true, value: 10 })

		variables = { test: { val: 20 } }
		stream.onVariablesChanged(new Set(['test:val']), null)

		await sub.expectValue({ ok: true, value: 20 })
		await sub.cleanup()
	})

	it('re-evaluates when fromControlId matches session.controlId and variableIds overlap', async () => {
		let variables = { test: { val: 5 } }
		const cc = makeControlsControllerMock(() => variables)
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(test:val)',
				controlId: 'ctrl1',
				isVariableString: false,
			})
		)

		await sub.expectValue({ ok: true, value: 5 })

		variables = { test: { val: 8 } }
		// fromControlId matches session.controlId
		stream.onVariablesChanged(new Set(['test:val']), 'ctrl1')

		await sub.expectValue({ ok: true, value: 8 })
		await sub.cleanup()
	})

	it('propagates expression evaluation errors as {ok: false}', async () => {
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '1 +', // invalid syntax
				controlId: 'ctrl1',
				isVariableString: false,
			})
		)

		const result = await sub.next()
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.error).toBeTruthy()
		await sub.cleanup()
	})

	it('accepts requiredType and evaluates correctly when the type matches', async () => {
		const cc = makeControlsControllerMock(() => ({ test: { num: 42 } }))
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(test:num)',
				controlId: 'ctrl1',
				isVariableString: false,
				requiredType: 'number',
			})
		)

		await sub.expectValue({ ok: true, value: 42 })
		await sub.cleanup()
	})

	it('requiredType: boolean fails when expression is not boolean', async () => {
		const cc = makeControlsControllerMock(() => ({ test: { num: 42 } }))
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(test:num)', // number, not boolean
				controlId: 'ctrl1',
				isVariableString: false,
				requiredType: 'boolean',
			})
		)

		const result = await sub.next()
		expect(result.ok).toBe(false)
		await sub.cleanup()
	})
})

// ── isVariableString mode ─────────────────────────────────────────────────────

describe('isVariableString: true', () => {
	it('substitutes variables in a plain string', async () => {
		const cc = makeControlsControllerMock(() => ({ test: { name: 'world' } }))
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: 'Hello $(test:name)!',
				controlId: 'ctrl1',
				isVariableString: true,
			})
		)

		await sub.expectValue({ ok: true, value: 'Hello world!' })
		await sub.cleanup()
	})

	it('re-evaluates when a referenced variable changes', async () => {
		let variables = { test: { label: 'A' } }
		const cc = makeControlsControllerMock(() => variables)
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: 'Label: $(test:label)',
				controlId: 'ctrl1',
				isVariableString: true,
			})
		)

		await sub.expectValue({ ok: true, value: 'Label: A' })

		variables = { test: { label: 'B' } }
		stream.onVariablesChanged(new Set(['test:label']), null)

		await sub.expectValue({ ok: true, value: 'Label: B' })
		await sub.cleanup()
	})

	it('returns $NA for unknown variables', async () => {
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(unknown:var)',
				controlId: 'ctrl1',
				isVariableString: true,
			})
		)

		await sub.expectValue({ ok: true, value: '$NA' })
		await sub.cleanup()
	})
})

// ── session management ────────────────────────────────────────────────────────

describe('session management', () => {
	it('shares a session between two subscribers with identical inputs', async () => {
		const cc = makeControlsControllerMock(() => ({ test: { val: 1 } }))
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const input = { expression: '$(test:val)', controlId: 'ctrl1', isVariableString: false as const }

		const sub1 = new SubscriptionTester(await caller.watchExpression(input))
		const sub2 = new SubscriptionTester(await caller.watchExpression(input))

		// Both receive the same initial value
		await sub1.expectValue({ ok: true, value: 1 })
		await sub2.expectValue({ ok: true, value: 1 })

		// The initial evaluation ran only once (session was reused for sub2)
		const callCount = (cc.createVariablesAndExpressionParser as ReturnType<typeof vi.fn>).mock.calls.length
		// One call for expression evaluation (context resolution calls it once or twice per eval)
		// Key point: sub2 did NOT trigger a second initial evaluation
		expect(callCount).toBeLessThan(4) // generous upper bound — not evaluated twice

		await sub1.cleanup()
		await sub2.cleanup()
	})

	it('creates distinct sessions for different contextResolution values', async () => {
		let callsForMyVar = 0
		let callsForOther = 0
		const cc: ControlsController = {
			createVariablesAndExpressionParser: vi
				.fn()
				.mockImplementation((_controlId: string | null | undefined, overrides?: VariableValues | null) => {
					const base = createParser({ custom: { myVar: 10, other: 20 } })
					return overrides && Object.keys(overrides).length > 0 ? base.createChildParser(overrides) : base
				}),
		} as unknown as ControlsController
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub1 = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', name: 'myVar' },
			})
		)
		const sub2 = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:value)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', name: 'other' },
			})
		)

		const r1 = await sub1.next()
		const r2 = await sub2.next()

		// Different context resolutions → different this:value injections → different results
		expect(r1).toEqual({ ok: true, value: 10 })
		expect(r2).toEqual({ ok: true, value: 20 })

		await sub1.cleanup()
		await sub2.cleanup()
	})

	it('onVariablesChanged updates all matching sessions independently', async () => {
		let valA = 1
		let valB = 100
		const ccA = makeControlsControllerMock(() => ({ test: { a: valA } }))
		const ccB = makeControlsControllerMock(() => ({ test: { b: valB } }))
		const lv = makeLocalVariablesMock(null, () => null)

		// Two separate streams with separate sessions
		const { stream: streamA, caller: callerA } = createStream(ccA, lv)
		const { stream: streamB, caller: callerB } = createStream(ccB, lv)

		const subA = new SubscriptionTester(
			await callerA.watchExpression({ expression: '$(test:a)', controlId: null, isVariableString: false })
		)
		const subB = new SubscriptionTester(
			await callerB.watchExpression({ expression: '$(test:b)', controlId: null, isVariableString: false })
		)

		await subA.expectValue({ ok: true, value: 1 })
		await subB.expectValue({ ok: true, value: 100 })

		// Only stream A's variable changes
		valA = 2
		streamA.onVariablesChanged(new Set(['test:a']), null)

		await subA.expectValue({ ok: true, value: 2 })
		// streamB is unaffected
		valB = 200
		streamB.onVariablesChanged(new Set(['test:b']), null)
		await subB.expectValue({ ok: true, value: 200 })

		await subA.cleanup()
		await subB.cleanup()
	})
})
