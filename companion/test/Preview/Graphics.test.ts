import EventEmitter from 'node:events'
import { initTRPC } from '@trpc/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'
import { DEFAULT_PREVIEW_RENDER_SIZE, type PreviewRenderSize } from '@companion-app/shared/Model/Preview.js'
import type { ControlCommonEvents } from '../../lib/Controls/ControlDependencies.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import type { ImageResult } from '../../lib/Graphics/ImageResult.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import { PreviewGraphics } from '../../lib/Preview/Graphics.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

const location: ControlLocation = { pageNumber: 1, row: 2, column: 3 }

/** The shape of a Stream Deck + touch strip segment */
const STRIP_SIZE: PreviewRenderSize = { width: 480, height: 240 }

/** An ImageResult which reports back the size it was asked for, so the tests can see what was drawn */
function makeRender(tag: string): ImageResult {
	return {
		style: { type: 'button' },
		drawNativeEncoded: vi.fn(async (width: number, height: number) => `${tag}:${width}x${height}`),
	} as unknown as ImageResult
}

describe('PreviewGraphics location subscription', () => {
	let preview: PreviewGraphics
	let graphics: GraphicsController & EventEmitter
	let render: ImageResult

	function createPreview() {
		render = makeRender('initial')

		graphics = new EventEmitter() as GraphicsController & EventEmitter
		graphics.getCachedRenderOrGeneratePlaceholder = vi.fn(() => render)

		const pageStore = { getControlIdAt: vi.fn(() => 'control-1') } as unknown as IPageStore
		const controls = {} as ControlsController
		const controlEvents = new EventEmitter<ControlCommonEvents>()

		preview = new PreviewGraphics(graphics, pageStore, controls, controlEvents)
	}

	async function watchLocation(size?: PreviewRenderSize) {
		const caller = t.createCallerFactory(preview.createTrpcRouter())(testCtx)
		return caller.location({ location, size }) as Promise<AsyncIterable<WrappedImage>>
	}

	beforeEach(() => {
		createPreview()
	})

	test('draws at the default size when none is asked for', async () => {
		const sub = new SubscriptionTester(await watchLocation())

		expect(await sub.next()).toEqual({ image: 'initial:288x288', isUsed: true })

		await sub.cleanup()
	})

	test('draws at the size that was asked for', async () => {
		const sub = new SubscriptionTester(await watchLocation(STRIP_SIZE))

		expect(await sub.next()).toEqual({ image: 'initial:480x240', isUsed: true })

		await sub.cleanup()
	})

	test('sends a redraw to each watched size', async () => {
		const square = new SubscriptionTester(await watchLocation(DEFAULT_PREVIEW_RENDER_SIZE))
		const strip = new SubscriptionTester(await watchLocation(STRIP_SIZE))

		await square.next()
		await strip.next()

		const redraw = makeRender('redraw')
		graphics.emit('button_drawn', location, redraw)

		expect(await square.next()).toEqual({ image: 'redraw:288x288', isUsed: true })
		expect(await strip.next()).toEqual({ image: 'redraw:480x240', isUsed: true })

		await square.cleanup()
		await strip.cleanup()
	})

	test('stops drawing a size once its last watcher has gone', async () => {
		const square = new SubscriptionTester(await watchLocation(DEFAULT_PREVIEW_RENDER_SIZE))
		const strip = new SubscriptionTester(await watchLocation(STRIP_SIZE))

		await square.next()
		await strip.next()
		await strip.cleanup()

		const redraw = makeRender('redraw')
		graphics.emit('button_drawn', location, redraw)

		expect(await square.next()).toEqual({ image: 'redraw:288x288', isUsed: true })

		// The strip is no longer watched, so nothing was drawn for it
		const drawnSizes = (redraw.drawNativeEncoded as any).mock.calls.map(([w, h]: [number, number]) => `${w}x${h}`)
		expect(drawnSizes).not.toContain('480x240')

		await square.cleanup()
	})
})
