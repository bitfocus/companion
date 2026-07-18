import { initTRPC } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import { PreviewExpressionStream } from '../../lib/Preview/ExpressionStream.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import type { LocalVariablesController } from '../../lib/Variables/LocalVariablesController.js'
import type { VariableValueData } from '../../lib/Variables/Util.js'
import { VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'
import { createMockTrpcContext } from '../Util.js'
import { mockUserConfig } from '../utils/MockUserConfig.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

// ── test infrastructure ──────────────────────────────────────────────────────

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()
const userconfig = mockUserConfig({ timezone: '' })

function createParser(
	variables: VariableValueData = {},
	overrides: VariableValues | null = null
): VariablesAndExpressionParser {
	// Mirror production's terminal construction (Values.createVariablesAndExpressionParser):
	// overrides are applied via the constructor's overrideVariableValues arg, not createChildParser.
	return new VariablesAndExpressionParser(userconfig, null as any, variables, new Map(), null, overrides)
}

/**
 * Build a mock ControlsController whose `createVariablesAndExpressionParser` returns
 * a real parser (with a fresh variable snapshot per call), applying any overrides so that
 * injected context variables like `this:current` resolve correctly.
 */
function makeControlsControllerMock(getVariables: () => VariableValueData): ControlsController {
	return {
		createVariablesAndExpressionParser: vi
			.fn()
			.mockImplementation((_controlId: string | null | undefined, overrides?: VariableValues | null) =>
				createParser(getVariables(), overrides ?? null)
			),
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
	it('injects $(this:current) from the current custom variable value', async () => {
		const variables = { custom: { myVar: 10 } }
		const cc = makeControlsControllerMock(() => variables)
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current) + 1',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', nameValue: exprVal('myVar') },
			})
		)

		await sub.expectValue({ ok: true, value: 11 })
		await sub.cleanup()
	})

	it('returns undefined for this:current when custom variable does not exist', async () => {
		const cc = makeControlsControllerMock(() => ({})) // no custom:myVar
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', nameValue: exprVal('myVar') },
			})
		)

		// custom:myVar does not exist, so this:current is injected as undefined and the
		// expression resolves to undefined.
		const result = await sub.next()
		expect(result).toEqual({ ok: true, value: undefined })
		await sub.cleanup()
	})

	it('re-evaluates when the tracked custom variable changes', async () => {
		let currentValue = 5
		const cc = makeControlsControllerMock(() => ({ custom: { myVar: currentValue } }))
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current) * 2',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', nameValue: exprVal('myVar') },
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
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', nameValue: exprVal('myVar') },
			})
		)

		await sub.next() // consume initial

		// Re-evaluation always goes through the parser factory; capture the count so we can
		// prove the unrelated change did not trigger another evaluation.
		const parserFactory = cc.createVariablesAndExpressionParser as ReturnType<typeof vi.fn>
		const callsBefore = parserFactory.mock.calls.length

		// Change a different variable
		stream.onVariablesChanged(new Set(['custom:otherVar']), null)

		// No re-evaluation expected — the parser factory was not invoked again
		expect(parserFactory.mock.calls.length).toBe(callsBefore)

		await sub.cleanup()
	})
})

// ── local variable context ───────────────────────────────────────────────────

describe('localVariable context resolution', () => {
	it('injects this:current and target:* from the local variable context', async () => {
		const context = { 'this:current': 5, 'target:counter': 5 }
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock({ controlId: 'ctrl1', name: 'counter' }, () => context)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current) + $(target:counter)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') },
			})
		)

		await sub.expectValue({ ok: true, value: 10 }) // 5 + 5
		await sub.cleanup()
	})

	it('re-evaluates when the target control changes (isTargetControlChange)', async () => {
		let context: VariableValues = { 'this:current': 3, 'target:counter': 3 }
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock({ controlId: 'ctrl1', name: 'counter' }, () => context)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current) + 1',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') },
			})
		)

		await sub.expectValue({ ok: true, value: 4 }) // 3 + 1

		// Update context (simulates local variable changing on ctrl1)
		context = { 'this:current': 9, 'target:counter': 9 }
		// The resolved target controlId is 'ctrl1' (set during first resolution)
		stream.onVariablesChanged(new Set(['local:counter']), new Set(['ctrl1']))

		await sub.expectValue({ ok: true, value: 10 }) // 9 + 1
		await sub.cleanup()
	})

	it('does NOT re-evaluate when a different control changes', async () => {
		const context = { 'this:current': 3, 'target:counter': 3 }
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock({ controlId: 'ctrl1', name: 'counter' }, () => context)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current) + 1',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') },
			})
		)

		await sub.next() // consume initial

		// Re-evaluation always goes through the parser factory; capture the count so we can
		// prove the change from a different control did not trigger another evaluation.
		const parserFactory = cc.createVariablesAndExpressionParser as ReturnType<typeof vi.fn>
		const callsBefore = parserFactory.mock.calls.length

		// Change from a different control — must not trigger re-evaluation
		stream.onVariablesChanged(new Set(['local:counter']), new Set(['different-ctrl']))

		// No re-evaluation expected — the parser factory was not invoked again
		expect(parserFactory.mock.calls.length).toBe(callsBefore)

		await sub.cleanup()
	})

	it('re-resolves when a control appears at the target location after subscription', async () => {
		// Regression: a localVariable context that does not resolve at subscription time never
		// stored a resolvedTargetControlId, so onVariablesChanged could never re-trigger it and
		// the preview stayed stale forever.
		// Note: localVariableFor returns null only when the location maps to no control — a missing
		// variable on an existing control still resolves (and is covered by isTargetControlChange).
		let localVariable: { controlId: string; name: string } | null = null // no control at the location yet
		let context: VariableValues | null = null
		const cc = makeControlsControllerMock(() => ({}))
		const lv = {
			localVariableFor: vi.fn().mockImplementation(() => localVariable),
			getLocalVariableContextFor: vi.fn().mockImplementation(() => context),
		} as unknown as LocalVariablesController
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') },
			})
		)

		// No control at the location yet — this:current is unresolved
		await sub.expectValue({ ok: true, value: undefined })

		// A control is now created at the target location (a controlIdsMoved event arrives)
		localVariable = { controlId: 'ctrl-target', name: 'counter' }
		context = { 'this:current': 5, 'target:counter': 5 }
		stream.onControlIdsLocationChanged(['ctrl-target'])

		// Resolution is retried and the expression re-evaluates with the freshly resolved context
		await sub.expectValue({ ok: true, value: 5 })
		await sub.cleanup()
	})

	it('re-resolves against a new control after the target control is deleted and recreated', async () => {
		// Regression: resolvedTargetControlId was never cleared when resolution later failed, so a
		// deleted target stayed pinned to its old control — a replacement control appearing at the
		// location would be ignored and the preview would stay stale.
		// (localVariableFor returning null models the control at the location being removed.)
		let localVariable: { controlId: string; name: string } | null = { controlId: 'ctrl-a', name: 'counter' }
		let context: VariableValues | null = { 'this:current': 1, 'target:counter': 1 }
		const cc = makeControlsControllerMock(() => ({}))
		const lv = {
			localVariableFor: vi.fn().mockImplementation(() => localVariable),
			getLocalVariableContextFor: vi.fn().mockImplementation(() => context),
		} as unknown as LocalVariablesController
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('counter') },
			})
		)

		await sub.expectValue({ ok: true, value: 1 }) // resolved against ctrl-a

		// Target control deleted — resolution now fails, which must clear the stored target controlId
		localVariable = null
		context = null
		stream.onControlIdsLocationChanged(['ctrl-a'])
		await sub.expectValue({ ok: true, value: undefined })

		// A DIFFERENT control appears at the location. Without clearing resolvedTargetControlId,
		// the session would stay pinned to ctrl-a and never pick up ctrl-b.
		localVariable = { controlId: 'ctrl-b', name: 'counter' }
		context = { 'this:current': 9, 'target:counter': 9 }
		stream.onControlIdsLocationChanged(['ctrl-b'])
		await sub.expectValue({ ok: true, value: 9 })

		await sub.cleanup()
	})

	it('resolves $(this:page)/$(this:row)/$(this:column) in locationValue using the session controlId', async () => {
		// The resolver parser must be created with session.controlId (not null) so that
		// this:* variables resolve against the current control's location.
		// Regression: previously used controlId=null which left this:* unresolved.
		const cc: ControlsController = {
			createVariablesAndExpressionParser: vi
				.fn()
				.mockImplementation((controlId: string | null, overrides?: VariableValues | null) => {
					// this:page/row/column are only available when a specific controlId is provided
					const variables: VariableValueData = controlId ? { this: { page: 1, row: 2, column: 3 } } : {}
					return createParser(variables, overrides ?? null)
				}),
		} as unknown as ControlsController

		const context = { 'this:current': 7, 'target:counter': 7 }
		const lv = makeLocalVariablesMock({ controlId: 'ctrl1', name: 'counter' }, () => context)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: {
					type: 'localVariable',
					locationValue: exprVal('$(this:page)/$(this:row)/$(this:column)'),
					nameValue: exprVal('counter'),
				},
			})
		)

		await sub.expectValue({ ok: true, value: 7 })

		// locationValue resolved to '1/2/3' — localVariableFor received the correct location
		expect(lv.localVariableFor).toHaveBeenCalledWith('1/2/3', 'counter', expect.anything())

		await sub.cleanup()
	})

	it('does not retry resolution on other-control changes when a context field is unresolved', async () => {
		// nameValue resolves to '' (field resolution failure). The field inputs are tracked in
		// variableIds, so unlike the no-control-at-location case there is no need to retry on
		// every control's local-variable changes.
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('') },
			})
		)

		await sub.next() // consume initial

		// Field resolution failed before the variable lookup
		expect(lv.localVariableFor).not.toHaveBeenCalled()

		const parserFactory = cc.createVariablesAndExpressionParser as ReturnType<typeof vi.fn>
		const callsBefore = parserFactory.mock.calls.length

		// A local-variable change on an unrelated control must not trigger a resolution retry
		stream.onVariablesChanged(new Set(['local:whatever']), new Set(['other-ctrl']))
		expect(parserFactory.mock.calls.length).toBe(callsBefore)

		await sub.cleanup()
	})

	it('retries resolution on grid changes without emitting a duplicate when it fails again', async () => {
		let localVariable: { controlId: string; name: string } | null = null // no control at the location yet
		let context: VariableValues | null = null
		const cc = makeControlsControllerMock(() => ({}))
		const lv = {
			localVariableFor: vi.fn().mockImplementation(() => localVariable),
			getLocalVariableContextFor: vi.fn().mockImplementation(() => context),
		} as unknown as LocalVariablesController
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('1/2/3'), nameValue: exprVal('counter') },
			})
		)

		await sub.expectValue({ ok: true, value: undefined })

		const lvSpy = lv.localVariableFor as ReturnType<typeof vi.fn>
		const callsBefore = lvSpy.mock.calls.length

		// A grid change elsewhere triggers a resolution retry (the session is unresolved), which
		// fails again with an identical result — re-evaluated, but no duplicate pushed to the client
		stream.onControlIdsLocationChanged(['some-other-ctrl'])
		expect(lvSpy.mock.calls.length).toBeGreaterThan(callsBefore)

		// A control now exists at the target location — the NEXT value the client receives is the
		// resolved one, proving the failed retry above did not emit a duplicate `undefined`
		localVariable = { controlId: 'ctrl-target', name: 'counter' }
		context = { 'this:current': 5, 'target:counter': 5 }
		stream.onControlIdsLocationChanged(['ctrl-target'])
		await sub.expectValue({ ok: true, value: 5 })

		await sub.cleanup()
	})

	it('does not retry resolution on local-variable changes from other controls while unresolved', async () => {
		// Grid changes (onControlIdsLocationChanged) are the retry trigger for unresolved sessions —
		// local-variable *value* changes on unrelated controls must not cause retries.
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock(null, () => null) // no control at the location
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('1/2/3'), nameValue: exprVal('counter') },
			})
		)

		await sub.next() // consume initial

		const parserFactory = cc.createVariablesAndExpressionParser as ReturnType<typeof vi.fn>
		const callsBefore = parserFactory.mock.calls.length

		stream.onVariablesChanged(new Set(['local:whatever']), new Set(['other-ctrl']))
		expect(parserFactory.mock.calls.length).toBe(callsBefore)

		await sub.cleanup()
	})

	it('does not re-evaluate a session pinned to an unaffected control on grid changes', async () => {
		const context = { 'this:current': 3, 'target:counter': 3 }
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock({ controlId: 'ctrl-a', name: 'counter' }, () => context)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('1/2/3'), nameValue: exprVal('counter') },
			})
		)

		await sub.next() // consume initial — resolved to ctrl-a

		const parserFactory = cc.createVariablesAndExpressionParser as ReturnType<typeof vi.fn>
		const callsBefore = parserFactory.mock.calls.length

		// A grid change not involving ctrl-a (or the session's own ctrl1) is irrelevant
		stream.onControlIdsLocationChanged(['ctrl-elsewhere'])
		expect(parserFactory.mock.calls.length).toBe(callsBefore)

		await sub.cleanup()
	})

	it('evaluates without context when localVariableFor returns null (variable not found)', async () => {
		const cc = makeControlsControllerMock(() => ({}))
		const lv = makeLocalVariablesMock(null, () => null) // not found
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'localVariable', locationValue: exprVal('this'), nameValue: exprVal('missing') },
			})
		)

		// Should still return a result, just without context — this:current is unresolved
		// and resolves to undefined.
		const result = await sub.next()
		expect(result).toEqual({ ok: true, value: undefined })
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
		stream.onVariablesChanged(new Set(['test:val']), new Set(['ctrl1']))

		await sub.expectValue({ ok: true, value: 8 })
		await sub.cleanup()
	})

	it('re-evaluates when the session control is moved ($(this:page) etc)', async () => {
		let variables: VariableValueData = { this: { page: 1 } }
		const cc = makeControlsControllerMock(() => variables)
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:page)',
				controlId: 'ctrl1',
				isVariableString: false,
			})
		)

		await sub.expectValue({ ok: true, value: 1 })

		// The control is moved to another page — no variables_changed fires, but the grid event does
		variables = { this: { page: 2 } }
		stream.onControlIdsLocationChanged(['ctrl1'])

		await sub.expectValue({ ok: true, value: 2 })
		await sub.cleanup()
	})

	it('does not emit a duplicate when a re-evaluation produces an identical result', async () => {
		let variables = { test: { val: 5 } }
		const cc = makeControlsControllerMock(() => variables)
		const lv = makeLocalVariablesMock(null, () => null)
		const { stream, caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(test:val) > 0',
				controlId: 'ctrl1',
				isVariableString: false,
			})
		)

		await sub.expectValue({ ok: true, value: true }) // 5 > 0

		// Referenced variable changes, but the result is still true — re-evaluated, no emit
		variables = { test: { val: 8 } }
		stream.onVariablesChanged(new Set(['test:val']), null)

		// Now the result actually changes — this must be the NEXT value the client receives,
		// proving the unchanged re-evaluation above was not pushed as a duplicate `true`
		variables = { test: { val: -1 } }
		stream.onVariablesChanged(new Set(['test:val']), null)

		await sub.expectValue({ ok: true, value: false })
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

	it('requiredType: boolean coerces a non-boolean expression result', async () => {
		const cc = makeControlsControllerMock(() => ({ test: { num: 42 } }))
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(test:num)', // number, coerced to boolean
				controlId: 'ctrl1',
				isVariableString: false,
				requiredType: 'boolean',
			})
		)

		await sub.expectValue({ ok: true, value: true })
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
		const parserFactory = cc.createVariablesAndExpressionParser as ReturnType<typeof vi.fn>

		const sub1 = new SubscriptionTester(await caller.watchExpression(input))
		await sub1.expectValue({ ok: true, value: 1 })

		// The first subscriber created the session and ran the single initial evaluation.
		const callsAfterSub1 = parserFactory.mock.calls.length

		const sub2 = new SubscriptionTester(await caller.watchExpression(input))
		await sub2.expectValue({ ok: true, value: 1 })

		// sub2 reused the existing session, so it must not have invoked the parser factory again.
		expect(parserFactory.mock.calls.length).toBe(callsAfterSub1)

		await sub1.cleanup()
		await sub2.cleanup()
	})

	it('creates distinct sessions for different contextResolution values', async () => {
		const cc: ControlsController = {
			createVariablesAndExpressionParser: vi
				.fn()
				.mockImplementation((_controlId: string | null | undefined, overrides?: VariableValues | null) =>
					createParser({ custom: { myVar: 10, other: 20 } }, overrides ?? null)
				),
		} as unknown as ControlsController
		const lv = makeLocalVariablesMock(null, () => null)
		const { caller } = createStream(cc, lv)

		const sub1 = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', nameValue: exprVal('myVar') },
			})
		)
		const sub2 = new SubscriptionTester(
			await caller.watchExpression({
				expression: '$(this:current)',
				controlId: 'ctrl1',
				isVariableString: false,
				contextResolution: { type: 'customVariable', nameValue: exprVal('other') },
			})
		)

		const r1 = await sub1.next()
		const r2 = await sub2.next()

		// Different context resolutions → different this:current injections → different results
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
