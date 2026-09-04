import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { defaultFallbackInView } from 'react-intersection-observer'
import { afterEach } from 'vitest'

afterEach(() => {
	cleanup()
})

// react-intersection-observer's useInView has no IntersectionObserver in jsdom; treat everything
// as in-view so visibility-gated content (and its subscriptions) renders during tests.
defaultFallbackInView(true)

// @tanstack/react-virtual and @base-ui/react use ResizeObserver in jsdom where it doesn't exist
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
window.ResizeObserver = ResizeObserverStub

// @tanstack/react-virtual uses offsetHeight to calculate scroll range; jsdom always returns 0.
// Without a non-zero value the virtualizer renders no items.
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
	configurable: true,
	get() {
		return 400
	},
})

// base-ui wraps open/close in requestAnimationFrame (a macrotask). jsdom's RAF is never
// flushed by React's act(), so popups never open. Use queueMicrotask instead — microtasks
// are flushed by act().
window.requestAnimationFrame = (fn: FrameRequestCallback): number => {
	queueMicrotask(() => fn(performance.now()))
	return 0
}
window.cancelAnimationFrame = () => {}

// jsdom has no canvas implementation, and we deliberately don't install the `canvas` npm package.
// jsdom's getContext already returns null (canvas-drawing code paths guard for this), but it also logs
// a noisy "Not implemented" error on every call. Stub it to return null directly — same behaviour, no noise.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

// jsdom's CSS parser (rrweb-cssom) is far stricter than a browser and rejects some modern CSS in our
// stylesheets (color-mix(), :has(), @layer, …). It skips the offending sheet and carries on, but
// writes a noisy "Could not parse CSS stylesheet" straight to stderr — bypassing console, so
// onConsoleLog / console.error patches don't catch it. Filter out that one line.
const originalStderrWrite = process.stderr.write.bind(process.stderr) as (...args: unknown[]) => boolean
process.stderr.write = (chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
	if (typeof chunk === 'string' && chunk.includes('Could not parse CSS stylesheet')) return true
	return originalStderrWrite(chunk, ...rest)
}

// base-ui uses matchMedia for responsive behaviour
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	}),
})
