import EventEmitter from 'node:events'
import { initTRPC } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ResolvedFeedbackStyleOverride } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsReferenceElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlCommonEvents } from '../../lib/Controls/ControlDependencies.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import type { RenderClock } from '../../lib/Controls/RenderClock.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import { ImageResult } from '../../lib/Graphics/ImageResult.js'
import type { CompositeElementDefinition, InstanceDefinitions } from '../../lib/Instance/Definitions.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import { PreviewElementStream } from '../../lib/Preview/ElementStream.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import type { VariableValueData } from '../../lib/Variables/Util.js'
import { VariablesAndExpressionParser } from '../../lib/Variables/VariablesAndExpressionParser.js'
import { createMockTrpcContext } from '../Util.js'
import { mockUserConfig } from '../utils/MockUserConfig.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

// ── element factories ────────────────────────────────────────────────────────

const USAGE = ButtonGraphicsElementUsage.Automatic

function val<T>(value: T): ExpressionOrValue<T> {
	return { isExpression: false, value }
}

function expr<T>(value: string): ExpressionOrValue<T> {
	return { isExpression: true, value }
}

function makeTextEl(overrides: Partial<ButtonGraphicsTextElement> = {}): ButtonGraphicsTextElement {
	return {
		id: 'text1',
		name: '',
		type: 'text',
		pinnedProperties: [],
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		rotation: val(0),
		text: val('Test'),
		fontsize: val(100),
		fontsizeAllowShrink: val(true),
		font: val('companion-sans'),
		weight: val('normal'),
		styles: val([]),
		color: val(0xffffff),
		halign: val('center'),
		valign: val('center'),
		outlineColor: val(0),
		...overrides,
	}
}

function makeGroupEl(
	children: SomeButtonGraphicsElement[],
	overrides: Partial<ButtonGraphicsGroupElement> = {}
): ButtonGraphicsGroupElement {
	return {
		id: 'group1',
		name: '',
		type: 'group',
		pinnedProperties: [],
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		rotation: val(0),
		squareCoords: val(false),
		...overrides,
		children,
	}
}

function makeReferenceEl(overrides: Partial<ButtonGraphicsReferenceElement> = {}): ButtonGraphicsReferenceElement {
	return {
		id: 'ref1',
		name: '',
		type: 'reference',
		pinnedProperties: [],
		usage: USAGE,
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		rotation: val(0),
		location: val(''),
		...overrides,
	}
}

function makeCompositeEl(): SomeButtonGraphicsElement {
	return {
		id: 'composite1',
		name: '',
		type: 'composite',
		rotation: val(0),
		usage: USAGE,
		connectionId: 'conn',
		elementId: 'myComposite',
		enabled: val(true),
		opacity: val(100),
		x: val(0),
		y: val(0),
		width: val(100),
		height: val(100),
		pinnedProperties: [],
	}
}

function makeBoxDrawEl(id: string, color: number): ButtonGraphicsBoxDrawElement {
	return {
		id,
		type: 'box',
		usage: USAGE,
		enabled: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		color,
		cornerRadius: 0,
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
		contentHash: `${id}-${color}`,
	}
}

function makeCompositeDefinition(text: string): CompositeElementDefinition {
	return {
		id: 'myComposite',
		name: 'My Composite',
		sortKey: null,
		description: undefined,
		elements: [makeTextEl({ id: 'inner-text', text: val(text) })],
		options: [],
	}
}

function findElement(
	elements: readonly SomeButtonGraphicsElement[],
	id: string
): SomeButtonGraphicsElement | undefined {
	for (const element of elements) {
		if (element.id === id) return element
		if (element.type === 'group') {
			const found = findElement(element.children, id)
			if (found) return found
		}
	}
	return undefined
}

// ── test harness ─────────────────────────────────────────────────────────────

const t = initTRPC.context<TrpcContext>().create()
const userconfig = mockUserConfig({ timezone: '' })

const CONTROL_ID = 'control1'
const CONTROL_LOCATION: ControlLocation = { pageNumber: 1, row: 0, column: 0 }

/**
 * A real PreviewElementStream, over mocked collaborators whose state each test can change.
 * Conversion uses the real ConvertSomeButtonGraphicsElementForDrawing and a real parser.
 */
function createHarness(initialElements: SomeButtonGraphicsElement[], initialVariables: VariableValueData = {}) {
	const state = {
		elements: initialElements,
		variables: initialVariables,
		compositeDefinition: makeCompositeDefinition('composite text'),
		renders: new Map<string, ImageResult>(),
		feedbackOverrides: new Map<string, ReadonlyMap<string, ResolvedFeedbackStyleOverride>>(),
		/** Throw from the next evaluation, to test error handling */
		failNextEvaluation: false,
	}

	const control = {
		supportsLayeredStyle: true,
		supportsEntities: true,
		layeredStyleGetElementById: (id: string) => findElement(state.elements, id),
		entities: { getFeedbackStyleOverrides: () => state.feedbackOverrides },
		drawing: { resolveDefaultNoTopBar: () => false },
	}

	const controlsController = {
		getControl: vi.fn((controlId: string) => {
			if (controlId === CONTROL_ID) return control
			if (controlId === 'not-layered') return { supportsLayeredStyle: false, supportsEntities: true }
			if (controlId === 'no-entities') return { supportsLayeredStyle: true, supportsEntities: false }
			return undefined
		}),
		createVariablesAndExpressionParser: vi.fn(() => {
			if (state.failNextEvaluation) {
				state.failNextEvaluation = false
				throw new Error('Evaluation failed')
			}
			return new VariablesAndExpressionParser(
				userconfig,
				null as any,
				state.variables,
				new Map(),
				null,
				null,
				null,
				undefined
			)
		}),
	} as unknown as ControlsController

	const instanceDefinitions = {
		getCompositeElementDefinition: vi.fn((connectionId: string, elementId: string) =>
			connectionId === 'conn' && elementId === 'myComposite' ? state.compositeDefinition : undefined
		),
	} as unknown as InstanceDefinitions

	const graphicsController = Object.assign(new EventEmitter(), {
		renderPixelBuffers: vi.fn(async () => undefined),
		getCachedRender: vi.fn((location: ControlLocation) => state.renders.get(formatLocation(location))),
	}) as unknown as GraphicsController & EventEmitter

	const pageStore = {
		getLocationOfControlId: vi.fn((controlId: string) => (controlId === CONTROL_ID ? CONTROL_LOCATION : undefined)),
	} as unknown as IPageStore

	const controlEvents = new EventEmitter<ControlCommonEvents>()

	let clockCallback: (() => void) | null = null
	const renderClock = {
		subscribe: vi.fn((cb: () => void) => {
			clockCallback = cb
			return () => {
				clockCallback = null
			}
		}),
	} as unknown as RenderClock

	const stream = new PreviewElementStream(
		instanceDefinitions,
		graphicsController,
		pageStore,
		controlsController,
		controlEvents,
		renderClock
	)
	const caller = t.createCallerFactory(stream.createTrpcRouter())(createMockTrpcContext())

	/** How many times an element has been evaluated, as each evaluation creates one parser */
	const evaluationCount = () => vi.mocked(controlsController.createVariablesAndExpressionParser).mock.calls.length

	return {
		state,
		stream,
		graphicsController,
		controlEvents,
		evaluationCount,
		tickClock: () => clockCallback?.(),
		isClockSubscribed: () => clockCallback !== null,
		watch: async (elementId: string, controlId = CONTROL_ID) =>
			new SubscriptionTester(await caller.watchElement({ controlId, elementId })),
	}
}

function setReferenceRender(
	harness: ReturnType<typeof createHarness>,
	location: string,
	drawElements: SomeButtonGraphicsDrawElement[]
) {
	harness.state.renders.set(
		location,
		new ImageResult(undefined, null, async () => Buffer.alloc(0), drawElements, new Set())
	)
}

/** Let any evaluation in flight finish */
async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 20))
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('PreviewElementStream.watchElement', () => {
	describe('initial value', () => {
		it('yields null, then the evaluated element', async () => {
			const harness = createHarness([makeTextEl({ text: expr('`Hello ${$(custom:a)}`') })], { custom: { a: 1 } })
			const sub = await harness.watch('text1')

			await sub.expectValue({ ok: true, element: null })
			const result = await sub.next()
			expect(result.element).toMatchObject({ id: 'text1', type: 'text', text: 'Hello 1' })

			await sub.cleanup()
		})

		it('yields a null element for an element that does not exist', async () => {
			const harness = createHarness([makeTextEl()])
			const sub = await harness.watch('missing')

			await sub.expectValue({ ok: true, element: null })
			await sub.expectValue({ ok: true, element: null })
			expect(harness.evaluationCount()).toBe(0)

			await sub.cleanup()
		})

		it('yields a null element for an unknown control, or one without a layered style or entities', async () => {
			const harness = createHarness([makeTextEl()])

			for (const controlId of ['unknown', 'not-layered', 'no-entities']) {
				const sub = await harness.watch('text1', controlId)
				await sub.expectValue({ ok: true, element: null })
				await sub.expectValue({ ok: true, element: null })
				await sub.cleanup()
			}

			expect(harness.evaluationCount()).toBe(0)
		})

		it('evaluates a nested element', async () => {
			const harness = createHarness([makeGroupEl([makeTextEl({ id: 'nested', text: val('Nested') })])])
			const sub = await harness.watch('nested')

			await sub.expectValue({ ok: true, element: null })
			expect((await sub.next()).element).toMatchObject({ id: 'nested', text: 'Nested' })

			await sub.cleanup()
		})

		it('evaluates a group without its children, as those are watched independently', async () => {
			const harness = createHarness([makeGroupEl([makeTextEl()], { rotation: val(30) })])
			const sub = await harness.watch('group1')

			await sub.expectValue({ ok: true, element: null })
			expect((await sub.next()).element).toMatchObject({ id: 'group1', type: 'group', rotation: 30, children: [] })

			await sub.cleanup()
		})

		it('embeds the children of a reference from the referenced render', async () => {
			const harness = createHarness([makeReferenceEl({ location: val('1/2/3') })])
			setReferenceRender(harness, '1/2/3', [makeBoxDrawEl('remote-box', 0xff0000)])
			const sub = await harness.watch('ref1')

			await sub.expectValue({ ok: true, element: null })
			const result = await sub.next()
			expect(result.element).toMatchObject({ id: 'ref1', type: 'reference' })
			expect(result.element?.type === 'reference' && result.element.children.map((child) => child.id)).toEqual([
				'remote-box',
			])

			await sub.cleanup()
		})
	})

	describe('variable changes', () => {
		it('re-evaluates when a variable the element uses changes', async () => {
			const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], { custom: { a: 1 } })
			const sub = await harness.watch('text1')
			await sub.next()
			expect((await sub.next()).element).toMatchObject({ text: '1' })

			harness.state.variables = { custom: { a: 2 } }
			harness.stream.onVariablesChanged(new Set(['custom:a']), null)

			expect((await sub.next()).element).toMatchObject({ text: '2' })

			await sub.cleanup()
		})

		it('does not re-evaluate when an unrelated variable changes', async () => {
			const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], { custom: { a: 1 } })
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			harness.stream.onVariablesChanged(new Set(['custom:b']), null)
			await settle()

			expect(harness.evaluationCount()).toBe(evaluations)

			await sub.cleanup()
		})

		it('respects the control id filter', async () => {
			const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], { custom: { a: 1 } })
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			harness.state.variables = { custom: { a: 2 } }
			harness.stream.onVariablesChanged(new Set(['custom:a']), new Set(['other-control']))
			await settle()
			expect(harness.evaluationCount()).toBe(evaluations)

			harness.stream.onVariablesChanged(new Set(['custom:a']), new Set([CONTROL_ID]))
			expect((await sub.next()).element).toMatchObject({ text: '2' })

			await sub.cleanup()
		})

		it('tracks the variables used by the latest evaluation', async () => {
			const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], {
				custom: { a: 1, b: 10 },
			})
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()

			// Switch the element to use a different variable
			harness.state.elements = [makeTextEl({ text: expr('$(custom:b)') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			expect((await sub.next()).element).toMatchObject({ text: '10' })

			// The old variable is no longer tracked
			const evaluations = harness.evaluationCount()
			harness.stream.onVariablesChanged(new Set(['custom:a']), null)
			await settle()
			expect(harness.evaluationCount()).toBe(evaluations)

			// The new one is
			harness.state.variables = { custom: { a: 1, b: 11 } }
			harness.stream.onVariablesChanged(new Set(['custom:b']), null)
			expect((await sub.next()).element).toMatchObject({ text: '11' })

			await sub.cleanup()
		})
	})

	describe('element changes', () => {
		it('re-evaluates when the element itself changes', async () => {
			const harness = createHarness([makeTextEl({ text: val('Before') })])
			const sub = await harness.watch('text1')
			await sub.next()
			expect((await sub.next()).element).toMatchObject({ text: 'Before' })

			harness.state.elements = [makeTextEl({ text: val('After') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')

			expect((await sub.next()).element).toMatchObject({ text: 'After' })

			await sub.cleanup()
		})

		it('does not re-evaluate for a change to another element, or to the same element of another control', async () => {
			const harness = createHarness([makeTextEl(), makeTextEl({ id: 'text2' })])
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text2')
			harness.controlEvents.emit('layeredStyleElementChanged', 'other-control', 'text1')
			await settle()

			expect(harness.evaluationCount()).toBe(evaluations)

			await sub.cleanup()
		})

		it('applies feedback style overrides, and re-reads them when only they change', async () => {
			const harness = createHarness([makeTextEl({ color: val(0xffffff) })])
			harness.state.feedbackOverrides.set('text1', new Map([['color', { value: val(0xff0000), thisContext: null }]]))
			const sub = await harness.watch('text1')
			await sub.next()
			expect((await sub.next()).element).toMatchObject({ color: 0xff0000 })

			// A feedback change leaves the element definition alone, but still emits an element change
			harness.state.feedbackOverrides.clear()
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			expect((await sub.next()).element).toMatchObject({ color: 0xffffff })

			await sub.cleanup()
		})

		it('yields a null element once the element is removed', async () => {
			const harness = createHarness([makeTextEl()])
			const sub = await harness.watch('text1')
			await sub.next()
			expect((await sub.next()).element).not.toBeNull()

			harness.state.elements = []
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')

			await sub.expectValue({ ok: true, element: null })

			await sub.cleanup()
		})
	})

	describe('render clock', () => {
		it('re-evaluates a clock sensitive element on each tick', async () => {
			const harness = createHarness([makeTextEl({ text: expr('oscillate(1000)') })])
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			harness.tickClock()

			expect((await sub.next()).element).toMatchObject({ id: 'text1', type: 'text' })
			expect(harness.evaluationCount()).toBe(evaluations + 1)

			await sub.cleanup()
		})

		it('stops re-evaluating on ticks once the element is no longer clock sensitive', async () => {
			const harness = createHarness([makeTextEl({ text: expr('oscillate(1000)') })])
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()

			harness.state.elements = [makeTextEl({ text: val('Static') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			expect((await sub.next()).element).toMatchObject({ text: 'Static' })
			const evaluations = harness.evaluationCount()

			harness.tickClock()
			await settle()

			expect(harness.evaluationCount()).toBe(evaluations)

			await sub.cleanup()
		})

		it('unsubscribes from the render clock when destroyed', () => {
			const harness = createHarness([])
			expect(harness.isClockSubscribed()).toBe(true)

			harness.stream.destroy()

			expect(harness.isClockSubscribed()).toBe(false)
		})

		it('does not re-evaluate an element that is not clock sensitive', async () => {
			const harness = createHarness([makeTextEl({ text: val('Static') })])
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			harness.tickClock()
			await settle()

			expect(harness.evaluationCount()).toBe(evaluations)

			await sub.cleanup()
		})
	})

	describe('referenced locations', () => {
		it('re-evaluates when a referenced button is drawn', async () => {
			const harness = createHarness([makeReferenceEl({ location: val('1/2/3') })])
			setReferenceRender(harness, '1/2/3', [makeBoxDrawEl('remote-box', 0xff0000)])
			const sub = await harness.watch('ref1')
			await sub.next()
			await sub.next()

			setReferenceRender(harness, '1/2/3', [makeBoxDrawEl('remote-box-2', 0x00ff00)])
			harness.graphicsController.emit('button_drawn', { pageNumber: 1, row: 2, column: 3 })

			const result = await sub.next()
			expect(result.element?.type === 'reference' && result.element.children.map((child) => child.id)).toEqual([
				'remote-box-2',
			])

			await sub.cleanup()
		})

		it('does not re-evaluate when an unrelated button is drawn', async () => {
			const harness = createHarness([makeReferenceEl({ location: val('1/2/3') })])
			setReferenceRender(harness, '1/2/3', [makeBoxDrawEl('remote-box', 0xff0000)])
			const sub = await harness.watch('ref1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			harness.graphicsController.emit('button_drawn', { pageNumber: 1, row: 2, column: 4 })
			await settle()

			expect(harness.evaluationCount()).toBe(evaluations)

			await sub.cleanup()
		})
	})

	describe('composite elements', () => {
		it('re-evaluates when the definition of a used composite element changes', async () => {
			const harness = createHarness([makeCompositeEl()])
			const sub = await harness.watch('composite1')
			await sub.next()
			const first = await sub.next()
			expect(JSON.stringify(first.element)).toContain('composite text')

			harness.state.compositeDefinition = makeCompositeDefinition('changed text')
			harness.stream.onConnectionCompositeElementsChanged(new Set(['conn:myComposite']))

			const second = await sub.next()
			expect(JSON.stringify(second.element)).toContain('changed text')

			await sub.cleanup()
		})

		it('does not re-evaluate for an unrelated composite element', async () => {
			const harness = createHarness([makeCompositeEl()])
			const sub = await harness.watch('composite1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			harness.stream.onConnectionCompositeElementsChanged(new Set(['conn:otherComposite']))
			await settle()

			expect(harness.evaluationCount()).toBe(evaluations)

			await sub.cleanup()
		})
	})

	describe('sessions', () => {
		it('shares one evaluation between clients watching the same element', async () => {
			const harness = createHarness([makeTextEl({ text: val('Shared') })])
			const first = await harness.watch('text1')
			await first.next()
			expect((await first.next()).element).toMatchObject({ text: 'Shared' })

			// A second client gets the latest value straight away, without evaluating again
			const second = await harness.watch('text1')
			expect((await second.next()).element).toMatchObject({ text: 'Shared' })
			expect(harness.evaluationCount()).toBe(1)

			// And both receive later changes
			harness.state.elements = [makeTextEl({ text: val('Updated') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			expect((await first.next()).element).toMatchObject({ text: 'Updated' })
			expect((await second.next()).element).toMatchObject({ text: 'Updated' })
			expect(harness.evaluationCount()).toBe(2)

			await first.cleanup()
			await second.cleanup()
		})

		it('keeps the session while any client remains, and ends it with the last', async () => {
			const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], { custom: { a: 1 } })
			const first = await harness.watch('text1')
			const second = await harness.watch('text1')
			await first.next()
			await first.next()
			await second.next()

			// With one client left, changes are still evaluated
			await first.cleanup()
			harness.state.variables = { custom: { a: 2 } }
			harness.stream.onVariablesChanged(new Set(['custom:a']), null)
			expect((await second.next()).element).toMatchObject({ text: '2' })

			// Once the last client leaves, nothing is evaluated
			await second.cleanup()
			const evaluations = harness.evaluationCount()
			harness.stream.onVariablesChanged(new Set(['custom:a']), null)
			await settle()
			expect(harness.evaluationCount()).toBe(evaluations)

			// And a new client starts a new session, evaluated afresh
			const third = await harness.watch('text1')
			await third.expectValue({ ok: true, element: null })
			expect((await third.next()).element).toMatchObject({ text: '2' })
			expect(harness.evaluationCount()).toBe(evaluations + 1)

			await third.cleanup()
		})

		it('keeps separate sessions for different elements', async () => {
			const harness = createHarness([makeTextEl({ text: val('One') }), makeTextEl({ id: 'text2', text: val('Two') })])
			const one = await harness.watch('text1')
			const two = await harness.watch('text2')

			await one.next()
			expect((await one.next()).element).toMatchObject({ text: 'One' })
			await two.next()
			expect((await two.next()).element).toMatchObject({ text: 'Two' })

			await one.cleanup()
			await two.cleanup()
		})
	})

	describe('evaluation scheduling', () => {
		it('coalesces changes made while an evaluation is in flight into one more evaluation', async () => {
			const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], { custom: { a: 1 } })
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			// The first change starts an evaluation, the rest land while it is in flight
			for (let i = 2; i <= 5; i++) {
				harness.state.variables = { custom: { a: i } }
				harness.stream.onVariablesChanged(new Set(['custom:a']), null)
			}

			// The in-flight evaluation read the first change; the pending one reads the latest
			expect((await sub.next()).element).toMatchObject({ text: '2' })
			expect((await sub.next()).element).toMatchObject({ text: '5' })

			await settle()
			expect(harness.evaluationCount()).toBe(evaluations + 2)

			await sub.cleanup()
		})

		it('keeps working after an evaluation fails', async () => {
			const harness = createHarness([makeTextEl({ text: val('Before') })])
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()

			harness.state.failNextEvaluation = true
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			await settle()

			// A new client still gets the last good result
			const late = await harness.watch('text1')
			expect((await late.next()).element).toMatchObject({ text: 'Before' })
			await late.cleanup()

			harness.state.elements = [makeTextEl({ text: val('After') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			// The failed evaluation yielded nothing, so this is the next value
			expect((await sub.next()).element).toMatchObject({ text: 'After' })

			await sub.cleanup()
		})

		it('runs a change that lands while a failing evaluation is in flight', async () => {
			const harness = createHarness([makeTextEl({ text: val('Before') })])
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()
			const evaluations = harness.evaluationCount()

			// The failing evaluation is still in flight when the second change lands
			harness.state.failNextEvaluation = true
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			harness.state.elements = [makeTextEl({ text: val('After') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')

			expect((await sub.next()).element).toMatchObject({ text: 'After' })
			expect(harness.evaluationCount()).toBe(evaluations + 2)

			await sub.cleanup()
		})
	})
})
