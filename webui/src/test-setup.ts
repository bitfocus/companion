import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
	cleanup()
})

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
