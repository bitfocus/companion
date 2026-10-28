import EventEmitter from 'node:events'
import { initTRPC } from '@trpc/server'
import { describe, expect, it, test, vi } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ElementRasterCanvas } from '@companion-app/shared/Graphics/ElementRaster.js'
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
import {
	ElementRasterCanvasSchema,
	PreviewElementStream,
	pruneRawElementsToTarget,
} from '../../lib/Preview/ElementStream.js'
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
const DEFAULT_CANVAS: ElementRasterCanvas = { width: 92, height: 92, paddingX: 10, paddingY: 10 }

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
		layeredStyleGetElements: () => state.elements,
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
		// Stand in for the real render, describing what it was asked to draw
		renderElementRaster: vi.fn(
			async (elements: SomeButtonGraphicsDrawElement[], elementId: string, canvas: ElementRasterCanvas) => ({
				image: 'raster:' + JSON.stringify({ elementId, canvas, elements }),
				renderedAt: { bounds: { x: 1, y: 2, width: 3, height: 4 }, rotations: [] },
			})
		),
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
	const createCaller = t.createCallerFactory(stream.createTrpcRouter())
	const caller = createCaller(createMockTrpcContext())

	/** The preview contexts opened for each control, which element streams are watched through */
	const contexts = new Map<string, SubscriptionTester<unknown>>()
	const openContext = async (controlId: string, canvas: ElementRasterCanvas = DEFAULT_CANVAS) => {
		const context = new SubscriptionTester(
			await caller.previewContext({ contextId: `context-${controlId}`, controlId, canvas })
		)
		await context.next()
		contexts.set(controlId, context)
		return context
	}

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
		createCaller,
		openContext,
		closeContext: async (controlId: string) => contexts.get(controlId)?.cleanup(),
		setCanvas: async (canvas: ElementRasterCanvas, controlId = CONTROL_ID) =>
			caller.setPreviewCanvas({ contextId: `context-${controlId}`, canvas }),
		renderCount: () => vi.mocked(graphicsController.renderElementRaster).mock.calls.length,
		watch: async (elementId: string, controlId = CONTROL_ID) => {
			if (!contexts.has(controlId)) await openContext(controlId)
			return new SubscriptionTester(await caller.watchElement({ contextId: `context-${controlId}`, elementId }))
		},
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

/**
 * The element a `raster` element was rendered from, as the stub render describes what it drew. Text is streamed as
 * rasters, so this gives the text it was drawn with
 */
function unraster(element: SomeButtonGraphicsDrawElement | null | undefined): SomeButtonGraphicsDrawElement | null {
	if (!element || element.type !== 'raster') return element ?? null

	const { elements } = JSON.parse(element.image.slice('raster:'.length)) as {
		elements: SomeButtonGraphicsDrawElement[]
	}
	const find = (list: SomeButtonGraphicsDrawElement[]): SomeButtonGraphicsDrawElement | null => {
		for (const candidate of list) {
			if (candidate.id === element.id) return candidate
			if (candidate.type === 'group' || candidate.type === 'reference') {
				const found = find(candidate.children)
				if (found) return found
			}
		}
		return null
	}
	return find(elements)
}

function textOf(element: SomeButtonGraphicsDrawElement | null | undefined): string | undefined {
	const source = unraster(element)
	return source?.type === 'text' ? source.text : undefined
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
			expect(unraster(result.element)).toMatchObject({ id: 'text1', type: 'text', text: 'Hello 1' })

			await sub.cleanup()
		})

		it('yields a null element for an element that does not exist', async () => {
			const harness = createHarness([makeTextEl()])
			const sub = await harness.watch('missing')

			await sub.expectValue({ ok: true, element: null })
			await settle()
			expect(harness.evaluationCount()).toBe(0)

			// Its evaluation to null is not resent, so the next value is the element once it is added
			harness.state.elements = [makeTextEl({ id: 'missing', text: val('Added') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'missing')
			expect(unraster((await sub.next()).element)).toMatchObject({ text: 'Added' })

			await sub.cleanup()
		})

		it('yields a null element for an unknown control, or one without a layered style or entities', async () => {
			const harness = createHarness([makeTextEl()])

			for (const controlId of ['unknown', 'not-layered', 'no-entities']) {
				const sub = await harness.watch('text1', controlId)
				await sub.expectValue({ ok: true, element: null })
				await settle()
				await sub.cleanup()
			}

			expect(harness.evaluationCount()).toBe(0)
		})

		it('evaluates a nested element', async () => {
			const harness = createHarness([makeGroupEl([makeTextEl({ id: 'nested', text: val('Nested') })])])
			const sub = await harness.watch('nested')

			await sub.expectValue({ ok: true, element: null })
			expect(unraster((await sub.next()).element)).toMatchObject({ id: 'nested', text: 'Nested' })

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
				'ref1/remote-box',
			])

			await sub.cleanup()
		})
	})

	describe('variable changes', () => {
		it('re-evaluates when a variable the element uses changes', async () => {
			const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], { custom: { a: 1 } })
			const sub = await harness.watch('text1')
			await sub.next()
			expect(unraster((await sub.next()).element)).toMatchObject({ text: '1' })

			harness.state.variables = { custom: { a: 2 } }
			harness.stream.onVariablesChanged(new Set(['custom:a']), null)

			expect(unraster((await sub.next()).element)).toMatchObject({ text: '2' })

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
			expect(unraster((await sub.next()).element)).toMatchObject({ text: '2' })

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
			expect(unraster((await sub.next()).element)).toMatchObject({ text: '10' })

			// The old variable is no longer tracked
			const evaluations = harness.evaluationCount()
			harness.stream.onVariablesChanged(new Set(['custom:a']), null)
			await settle()
			expect(harness.evaluationCount()).toBe(evaluations)

			// The new one is
			harness.state.variables = { custom: { a: 1, b: 11 } }
			harness.stream.onVariablesChanged(new Set(['custom:b']), null)
			expect(unraster((await sub.next()).element)).toMatchObject({ text: '11' })

			await sub.cleanup()
		})
	})

	describe('element changes', () => {
		it('re-evaluates when the element itself changes', async () => {
			const harness = createHarness([makeTextEl({ text: val('Before') })])
			const sub = await harness.watch('text1')
			await sub.next()
			expect(unraster((await sub.next()).element)).toMatchObject({ text: 'Before' })

			harness.state.elements = [makeTextEl({ text: val('After') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')

			expect(unraster((await sub.next()).element)).toMatchObject({ text: 'After' })

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
			expect(unraster((await sub.next()).element)).toMatchObject({ color: 0xff0000 })

			// A feedback change leaves the element definition alone, but still emits an element change
			harness.state.feedbackOverrides.clear()
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			expect(unraster((await sub.next()).element)).toMatchObject({ color: 0xffffff })

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
		it('re-evaluates a clock sensitive element on each tick, sending only a changed result', async () => {
			// oscillate() makes it clock sensitive, the variable lets a tick change the result deterministically
			const harness = createHarness([makeTextEl({ text: expr('`${$(custom:a)} ${oscillate(1000) >= -1}`') })], {
				custom: { a: 1 },
			})
			const sub = await harness.watch('text1')
			await sub.next()
			expect(unraster((await sub.next()).element)).toMatchObject({ text: '1 true' })
			const evaluations = harness.evaluationCount()

			// A tick that leaves the result unchanged is evaluated but not sent
			harness.tickClock()
			await settle()
			expect(harness.evaluationCount()).toBe(evaluations + 1)

			// Change the variable without notifying, so only the tick picks it up
			harness.state.variables = { custom: { a: 2 } }
			harness.tickClock()

			expect(unraster((await sub.next()).element)).toMatchObject({ text: '2 true' })
			expect(harness.evaluationCount()).toBe(evaluations + 2)

			await sub.cleanup()
		})

		it('stops re-evaluating on ticks once the element is no longer clock sensitive', async () => {
			const harness = createHarness([makeTextEl({ text: expr('oscillate(1000)') })])
			const sub = await harness.watch('text1')
			await sub.next()
			await sub.next()

			harness.state.elements = [makeTextEl({ text: val('Static') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			expect(unraster((await sub.next()).element)).toMatchObject({ text: 'Static' })
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
				'ref1/remote-box-2',
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
			expect(unraster((await first.next()).element)).toMatchObject({ text: 'Shared' })

			// A second client gets the latest value straight away, without evaluating again
			const second = await harness.watch('text1')
			expect(unraster((await second.next()).element)).toMatchObject({ text: 'Shared' })
			expect(harness.evaluationCount()).toBe(1)

			// And both receive later changes
			harness.state.elements = [makeTextEl({ text: val('Updated') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			expect(unraster((await first.next()).element)).toMatchObject({ text: 'Updated' })
			expect(unraster((await second.next()).element)).toMatchObject({ text: 'Updated' })
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
			expect(unraster((await second.next()).element)).toMatchObject({ text: '2' })

			// Once the last client leaves, nothing is evaluated
			await second.cleanup()
			const evaluations = harness.evaluationCount()
			harness.stream.onVariablesChanged(new Set(['custom:a']), null)
			await settle()
			expect(harness.evaluationCount()).toBe(evaluations)

			// And a new client starts a new session, evaluated afresh
			const third = await harness.watch('text1')
			await third.expectValue({ ok: true, element: null })
			expect(unraster((await third.next()).element)).toMatchObject({ text: '2' })
			expect(harness.evaluationCount()).toBe(evaluations + 1)

			await third.cleanup()
		})

		it('keeps separate sessions for different elements', async () => {
			const harness = createHarness([makeTextEl({ text: val('One') }), makeTextEl({ id: 'text2', text: val('Two') })])
			const one = await harness.watch('text1')
			const two = await harness.watch('text2')

			await one.next()
			expect(unraster((await one.next()).element)).toMatchObject({ text: 'One' })
			await two.next()
			expect(unraster((await two.next()).element)).toMatchObject({ text: 'Two' })

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

			// The final value is always the latest
			let latest = await sub.next()
			while (unraster(latest.element)?.type === 'text' && textOf(latest.element) !== '5') latest = await sub.next()
			expect(unraster(latest.element)).toMatchObject({ text: '5' })

			await settle()
			expect(harness.evaluationCount()).toBe(evaluations + 2)

			await sub.cleanup()
		})

		it('does not resend a result that is unchanged by a re-evaluation', async () => {
			const harness = createHarness([makeTextEl({ text: val('Same') })])
			const sub = await harness.watch('text1')
			await sub.next()
			expect(unraster((await sub.next()).element)).toMatchObject({ text: 'Same' })

			// Re-evaluated, but to the same result
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			await settle()

			// So the next value is the next real change
			harness.state.elements = [makeTextEl({ text: val('Different') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			expect(unraster((await sub.next()).element)).toMatchObject({ text: 'Different' })

			await sub.cleanup()
		})

		it('updates what it tracks even when a re-evaluation leaves the result unchanged', async () => {
			const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], { custom: { a: 1, b: 1 } })
			const sub = await harness.watch('text1')
			await sub.next()
			expect(unraster((await sub.next()).element)).toMatchObject({ text: '1' })

			// Switch to another variable with the same value, so the result is not resent
			harness.state.elements = [makeTextEl({ text: expr('$(custom:b)') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			await settle()

			// But the new variable is tracked
			harness.state.variables = { custom: { a: 1, b: 2 } }
			harness.stream.onVariablesChanged(new Set(['custom:b']), null)
			expect(unraster((await sub.next()).element)).toMatchObject({ text: '2' })

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
			expect(unraster((await late.next()).element)).toMatchObject({ text: 'Before' })
			await late.cleanup()

			harness.state.elements = [makeTextEl({ text: val('After') })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			// The failed evaluation yielded nothing, so this is the next value
			expect(unraster((await sub.next()).element)).toMatchObject({ text: 'After' })

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

			expect(unraster((await sub.next()).element)).toMatchObject({ text: 'After' })
			expect(harness.evaluationCount()).toBe(evaluations + 2)

			await sub.cleanup()
		})
	})
})

describe('PreviewElementStream preview contexts', () => {
	it('waits for its context to open', async () => {
		const harness = createHarness([makeTextEl()])
		const caller = harness.createCaller(createMockTrpcContext())
		const sub = new SubscriptionTester(
			await caller.watchElement({ contextId: `context-${CONTROL_ID}`, elementId: 'text1' })
		)

		const first = sub.next()
		await settle()
		await harness.openContext(CONTROL_ID)

		await expect(first).resolves.toEqual({ ok: true, element: null })
		expect((await sub.next()).element).toMatchObject({ type: 'raster' })

		await sub.cleanup()
	})

	it("can't use the context of another client", async () => {
		const harness = createHarness([makeTextEl()])
		await harness.openContext(CONTROL_ID)

		const other = harness.createCaller(createMockTrpcContext({ clientId: 'other-client' }))
		const sub = new SubscriptionTester(
			await other.watchElement({ contextId: `context-${CONTROL_ID}`, elementId: 'text1' }),
			{
				timeoutMs: 100,
			}
		)
		await expect(sub.next()).rejects.toThrow('timeout')
		expect(await other.setPreviewCanvas({ contextId: `context-${CONTROL_ID}`, canvas: DEFAULT_CANVAS })).toBe(false)
		expect(harness.evaluationCount()).toBe(0)
	})

	it('ends when its context ends', async () => {
		const harness = createHarness([makeTextEl()])
		const sub = await harness.watch('text1')
		await sub.next()
		await sub.next()

		await harness.closeContext(CONTROL_ID)

		await expect(sub.next()).rejects.toThrow('Subscription ended unexpectedly')
	})
})

function el(id: string, type: string, extra: Record<string, unknown> = {}): SomeButtonGraphicsElement {
	return { id, type, ...extra } as unknown as SomeButtonGraphicsElement
}

describe('pruneRawElementsToTarget', () => {
	const canvas = el('canvas', 'canvas')

	test('keeps the canvas and the path to the element', () => {
		const target = el('t', 'text')
		const elements = [canvas, el('a', 'box'), el('g', 'group', { children: [el('b', 'box'), target] }), el('c', 'text')]

		expect(pruneRawElementsToTarget(elements, 't')).toEqual([canvas, el('g', 'group', { children: [target] })])
	})

	test('the canvas itself', () => {
		expect(pruneRawElementsToTarget([canvas, el('a', 'box')], 'canvas')).toEqual([canvas])
	})

	test('null when the element is missing', () => {
		expect(pruneRawElementsToTarget([canvas, el('a', 'box')], 'missing')).toBeNull()
	})
})

describe('ElementRasterCanvasSchema', () => {
	const valid = (canvas: Record<string, number>) => ElementRasterCanvasSchema.safeParse(canvas).success

	test('accepts a canvas with room for the button', () => {
		expect(valid({ width: 92, height: 92, paddingX: 10, paddingY: 10 })).toBe(true)
		expect(valid({ width: 3, height: 3, paddingX: 1, paddingY: 1 })).toBe(true)
	})

	test('rejects padding that leaves no room for the button', () => {
		expect(valid({ width: 20, height: 92, paddingX: 10, paddingY: 10 })).toBe(false)
		expect(valid({ width: 92, height: 20, paddingX: 10, paddingY: 10 })).toBe(false)
		expect(valid({ width: 92, height: 92, paddingX: 50, paddingY: 0 })).toBe(false)
	})

	test('rejects a canvas that is too large or empty', () => {
		expect(valid({ width: 100000, height: 92, paddingX: 0, paddingY: 0 })).toBe(false)
		expect(valid({ width: 0, height: 92, paddingX: 0, paddingY: 0 })).toBe(false)
	})
})

describe('PreviewElementStream rasters', () => {
	function parseRaster(element: SomeButtonGraphicsDrawElement | null | undefined): {
		elementId: string
		canvas: ElementRasterCanvas
		elements: SomeButtonGraphicsDrawElement[]
	} {
		expect(element?.type).toBe('raster')
		const image = element?.type === 'raster' ? element.image : ''
		expect(image.startsWith('raster:')).toBe(true)
		return JSON.parse(image.slice('raster:'.length))
	}

	function childrenOf(element: SomeButtonGraphicsDrawElement | null | undefined): SomeButtonGraphicsDrawElement[] {
		return element?.type === 'group' || element?.type === 'reference' ? element.children : []
	}

	it('streams text as a raster element, with its geometry and drawn with its parents', async () => {
		const harness = createHarness([
			makeTextEl({ id: 'sibling' }),
			makeGroupEl([makeTextEl({ x: val(25), opacity: val(50), rotation: val(10) })], { rotation: val(30) }),
		])
		const sub = await harness.watch('text1')

		await sub.expectValue({ ok: true, element: null })
		const element = (await sub.next()).element
		expect(element).toMatchObject({
			id: 'text1',
			type: 'raster',
			x: 0.25,
			y: 0,
			opacity: 0.5,
			rotation: 10,
			renderedAt: { bounds: { x: 1, y: 2, width: 3, height: 4 }, rotations: [] },
		})

		const render = parseRaster(element)
		expect(render.elementId).toBe('text1')
		expect(render.canvas).toEqual(DEFAULT_CANVAS)
		// Drawn with its parents, but not its siblings
		expect(render.elements.map((el) => el.id)).toEqual(['group1'])
		expect(render.elements[0]).toMatchObject({ rotation: 30 })

		await sub.cleanup()
	})

	it('streams other elements unchanged, without rendering them', async () => {
		const harness = createHarness([makeGroupEl([makeTextEl()])])
		const sub = await harness.watch('group1')
		await sub.next()

		expect((await sub.next()).element).toMatchObject({ id: 'group1', type: 'group', children: [] })
		expect(harness.renderCount()).toBe(0)

		await sub.cleanup()
	})

	it('streams the text a composite draws as rasters, within the composite', async () => {
		const harness = createHarness([makeCompositeEl()])
		harness.state.compositeDefinition = {
			...makeCompositeDefinition('composite text'),
			elements: [makeTextEl({ id: 'inner-text', text: val('composite text') }), makeGroupEl([], { id: 'inner-group' })],
		}
		const sub = await harness.watch('composite1')
		await sub.next()

		const element = (await sub.next()).element
		expect(element).toMatchObject({ id: 'composite1', type: 'group' })
		const [innerText, innerGroup] = childrenOf(element)
		expect(innerGroup).toMatchObject({ type: 'group' })

		const render = parseRaster(innerText)
		expect(render.elementId).toBe(innerText.id)
		expect(render.elements.map((el) => el.id)).toEqual(['composite1'])

		await sub.cleanup()
	})

	it('streams the text a reference draws as rasters, and re-renders when the referenced button is drawn', async () => {
		const harness = createHarness([makeReferenceEl({ location: val('1/2/3') })])
		const remoteText = (text: string): SomeButtonGraphicsDrawElement => ({
			...makeBoxDrawEl('remote', 0),
			type: 'text',
			text,
			fontsize: 100,
			fontsizeAllowShrink: true,
			font: 'companion-sans',
			weight: 'normal',
			styles: [],
			halign: 'center',
			valign: 'center',
			outlineColor: 0,
			contentHash: text,
		})
		setReferenceRender(harness, '1/2/3', [remoteText('Before')])
		const sub = await harness.watch('ref1')
		await sub.next()

		const first = parseRaster(childrenOf((await sub.next()).element)[0])
		expect(first.elementId).toBe('ref1/remote')
		expect(first.elements).toMatchObject([{ id: 'ref1', children: [{ id: 'ref1/remote', text: 'Before' }] }])

		setReferenceRender(harness, '1/2/3', [remoteText('After')])
		harness.graphicsController.emit('button_drawn', { pageNumber: 1, row: 2, column: 3 })

		const second = parseRaster(childrenOf((await sub.next()).element)[0])
		expect(second.elements).toMatchObject([{ id: 'ref1', children: [{ text: 'After' }] }])

		await sub.cleanup()
	})

	it('re-renders for a change to a parent or the canvas element, but not to a sibling', async () => {
		const canvasEl = { ...makeGroupEl([], { id: 'canvas' }), type: 'canvas' } as unknown as SomeButtonGraphicsElement
		const harness = createHarness([canvasEl, makeTextEl({ id: 'sibling' }), makeGroupEl([makeTextEl()])])
		const sub = await harness.watch('text1')
		await sub.next()
		await sub.next()
		const evaluations = harness.evaluationCount()

		harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'sibling')
		await settle()
		expect(harness.evaluationCount()).toBe(evaluations)

		harness.state.elements = [canvasEl, makeTextEl({ id: 'sibling' }), makeGroupEl([makeTextEl()], { x: val(50) })]
		harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'group1')
		expect(parseRaster((await sub.next()).element).elements[1]).toMatchObject({ id: 'group1', x: 0.5 })

		harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'canvas')
		await settle()
		expect(harness.evaluationCount()).toBe(evaluations + 2)

		await sub.cleanup()
	})

	it('re-renders when a variable used by a parent changes', async () => {
		const harness = createHarness([makeGroupEl([makeTextEl()], { x: expr('$(custom:x)') })], { custom: { x: 0 } })
		const sub = await harness.watch('text1')
		await sub.next()
		await sub.next()

		harness.state.variables = { custom: { x: 25 } }
		harness.stream.onVariablesChanged(new Set(['custom:x']), null)

		expect(parseRaster((await sub.next()).element).elements[0]).toMatchObject({ id: 'group1', x: 0.25 })

		await sub.cleanup()
	})

	it('re-renders for a new canvas without resubscribing, keeping the old raster until then', async () => {
		const harness = createHarness([makeTextEl()])
		const sub = await harness.watch('text1')
		await sub.next()
		expect(parseRaster((await sub.next()).element).canvas).toEqual(DEFAULT_CANVAS)

		const small = { width: 50, height: 50, paddingX: 5, paddingY: 5 }
		await harness.setCanvas(small)

		// The next value is the raster for the new canvas, not an empty element
		expect(parseRaster((await sub.next()).element).canvas).toEqual(small)
		expect(harness.evaluationCount()).toBe(1)

		await sub.cleanup()
	})

	it('shares renders between contexts with the same canvas', async () => {
		const harness = createHarness([makeTextEl()])
		const first = await harness.watch('text1')
		await first.next()
		await first.next()

		// A second client, with its own context
		const other = harness.createCaller(createMockTrpcContext({ clientId: 'other-client' }))
		const otherContext = new SubscriptionTester(
			await other.previewContext({ contextId: 'context-other', controlId: CONTROL_ID, canvas: DEFAULT_CANVAS })
		)
		await otherContext.next()
		const second = new SubscriptionTester(await other.watchElement({ contextId: 'context-other', elementId: 'text1' }))
		expect((await second.next()).element).toMatchObject({ type: 'raster' })

		expect(harness.renderCount()).toBe(1)

		await first.cleanup()
		await second.cleanup()
		await otherContext.cleanup()
	})

	it('throttles renders of rapid changes, ending with the latest', async () => {
		const harness = createHarness([makeTextEl({ text: expr('$(custom:a)') })], { custom: { a: 0 } })
		const sub = await harness.watch('text1')
		await sub.next()
		await sub.next()

		for (let i = 1; i <= 10; i++) {
			harness.state.variables = { custom: { a: i } }
			harness.stream.onVariablesChanged(new Set(['custom:a']), null)
			await new Promise((resolve) => setTimeout(resolve, 5))
		}
		await new Promise((resolve) => setTimeout(resolve, 150))

		let latest = await sub.next()
		while (textOf(latest.element) !== '10') latest = await sub.next()
		// 10 changes over ~50ms, rendered at most once per 50ms
		expect(harness.renderCount()).toBeLessThanOrEqual(5)

		await sub.cleanup()
	})

	it('sends each render while changes arrive faster than it renders', async () => {
		const harness = createHarness([makeTextEl()])
		const render = vi.mocked(harness.graphicsController.renderElementRaster)
		const fastRender = render.getMockImplementation()!
		render.mockImplementation(async (...args) => {
			await new Promise((resolve) => setTimeout(resolve, 40))
			return fastRender(...args)
		})
		const sub = await harness.watch('text1')
		await sub.next()

		// A change every 15ms, so a newer one has always arrived by the time a render completes
		const rotations: unknown[] = []
		for (let i = 1; i <= 12; i++) {
			harness.state.elements = [makeTextEl({ rotation: val(i) })]
			harness.controlEvents.emit('layeredStyleElementChanged', CONTROL_ID, 'text1')
			await new Promise((resolve) => setTimeout(resolve, 15))
		}
		for (;;) {
			const element = (await sub.next()).element
			rotations.push(element?.type === 'raster' ? element.rotation : null)
			if (rotations.at(-1) === 12) break
		}

		// Renders were sent while the changes were still arriving, not only once they stopped
		expect(rotations.length).toBeGreaterThan(2)

		await sub.cleanup()
	})
})
