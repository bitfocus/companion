/* useResizeObserver.ts
 * Thin wrapper around `usehooks-ts`'s `useResizeObserver`.
 *
 * usehooks-ts 3.1.1 predates React 19: it types the `ref` option as `RefObject<T>`, but React 19's
 * `useRef<T>(null)` now yields `RefObject<T | null>`, which that signature rejects. We accept the
 * nullable ref our call sites actually hold and cast at this boundary, so app code stays type-safe.
 */
import type { RefObject } from 'react'
import { useResizeObserver as useResizeObserverInner } from 'usehooks-ts'

/** The size of the observed element. */
export interface Size {
	width: number | undefined
	height: number | undefined
}

export interface UseResizeObserverOptions<T extends HTMLElement> {
	/** The ref of the element to observe. */
	ref: RefObject<T | null>
	/** When set, the hook delegates size handling to this callback instead of re-rendering. */
	onResize?: (size: Size) => void
	/** The box model to use for the ResizeObserver. Defaults to 'content-box'. */
	box?: 'border-box' | 'content-box' | 'device-pixel-content-box'
}

export function useResizeObserver<T extends HTMLElement = HTMLElement>(options: UseResizeObserverOptions<T>): Size {
	return useResizeObserverInner<T>({ ...options, ref: options.ref as RefObject<T> })
}
