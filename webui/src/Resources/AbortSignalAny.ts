import { anySignal } from 'any-signal'

// AbortSignal.any is newer than some of the browsers we support (Chrome 116, Firefox 124, Safari 17.4)
if (typeof AbortSignal.any !== 'function') {
	Object.defineProperty(AbortSignal, 'any', {
		value: (signals: Iterable<AbortSignal>): AbortSignal => anySignal(Array.from(signals)),
		configurable: true,
		writable: true,
	})
}
