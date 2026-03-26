import { useCallback, useEffect, useRef } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'

interface StickyScrollState {
	follow: boolean
	rowCount: number
	isProgrammaticScroll: boolean
	hasMounted: boolean
}

/**
 * Manages "sticky to bottom" scroll behaviour for a virtualised list.
 * When the user scrolls away from the bottom, auto-following is disabled.
 * Scrolling back to the bottom re-enables it.
 *
 * @param parentRef  Ref to the scrollable container element.
 * @param virtualizer The virtualizer instance for the list.
 * @param count      Total number of items in the virtualizer (including any fixed header rows).
 * @returns An `onScroll` handler to attach to the scrollable container.
 */
export function useStickyScroll<TScrollElement extends HTMLElement>(
	parentRef: React.RefObject<TScrollElement | null>,
	virtualizer: Virtualizer<TScrollElement, Element>,
	count: number
): () => void {
	const state = useRef<StickyScrollState>({
		follow: true,
		rowCount: count,
		isProgrammaticScroll: false,
		hasMounted: false,
	})

	useEffect(() => {
		state.current.rowCount = count
	}, [count])

	const onScroll = useCallback(() => {
		if (state.current.isProgrammaticScroll) {
			state.current.isProgrammaticScroll = false
			return
		}

		// Ignore the first scroll event that fires on mount; instead scroll to bottom
		if (!state.current.hasMounted) {
			state.current.hasMounted = true

			setTimeout(() => {
				if (parentRef.current && state.current.rowCount > 0) {
					state.current.isProgrammaticScroll = true
					virtualizer.scrollToIndex(state.current.rowCount - 1, { align: 'end' })
				}
			}, 100)
			return
		}

		const el = parentRef.current
		if (!el) return

		// Re-enable following when the user scrolls back to the bottom
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10
		state.current.follow = atBottom
	}, [parentRef, virtualizer])

	// Scroll to bottom whenever count changes, if following is enabled
	useEffect(() => {
		if (state.current.follow) {
			state.current.isProgrammaticScroll = true
			virtualizer.scrollToIndex(count - 1, { align: 'end' })
		}
	}, [count, virtualizer])

	return onScroll
}
