import { useRef, useCallback, useEffect } from 'react'

interface ScrollVisibleState {
	ready: boolean
	topElementHash: string | undefined
	topElementOffset: number
}

export function useStickyScroller(initialHash: string | undefined) {
	const scrollerElementRef = useRef<HTMLDivElement>(null)
	const scrollerContentRef = useRef<HTMLDivElement>(null)

	// State to keep track of the visible elements.
	// This uses a ref to avoid re-rendering the component for each scroll
	const scrollVisibleState = useRef<ScrollVisibleState>({
		ready: false,
		topElementHash: initialHash,
		topElementOffset: 0,
	})

	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		const target = e.currentTarget

		if (!scrollVisibleState.current.ready) return

		// Find the top most relevant element in the scroller
		let elementAtTop: HTMLElement | null = null
		const currentElm = scrollerContentRef.current ?? scrollerElementRef.current
		if (currentElm) {
			for (const element0 of currentElm.querySelectorAll('[data-anchor]')) {
				const element = element0 as HTMLElement
				const elementHash = element.getAttribute('data-anchor')
				if (!elementHash) continue
				if (!elementAtTop) elementAtTop = element

				if (element.offsetTop + element.clientHeight > target.scrollTop) {
					elementAtTop = element
					break
				}
			}
		}

		// calculate offset into the top element
		const topElementOffset = elementAtTop ? target.scrollTop - elementAtTop.offsetTop : 0

		// Update the state
		scrollVisibleState.current = {
			ready: true,
			topElementHash: elementAtTop?.getAttribute('data-anchor') ?? undefined,
			topElementOffset,
		}
	}, [])

	// Preserve to trigger whenever the data updates
	const restoreScroll = useCallback(() => {
		const scrollState = scrollVisibleState.current
		const scrollerElm = scrollerElementRef.current
		if (!scrollState || !scrollerElm) return

		if (scrollerElementRef.current && scrollState.topElementHash) {
			// Find the target
			const targetElement = document.querySelector(
				`[data-anchor="${scrollState.topElementHash}"]`
			) as HTMLElement | null
			if (!targetElement) return

			// Scroll to the target
			scrollerElm.scrollTop = targetElement.offsetTop + scrollState.topElementOffset
		}
	}, [])

	// Ensure the scroll is restored when the page loads
	useEffect(() => {
		if (scrollVisibleState.current.ready) return
		const fn = () => {
			scrollVisibleState.current.ready = true
			restoreScroll()
		}
		if (document.readyState === 'complete') {
			fn()
			return
		} else {
			window.addEventListener('load', () => fn, false)
			return () => window.removeEventListener('load', fn)
		}
	}, [restoreScroll])

	return {
		scrollerContentRef,
		scrollerElementRef,
		handleScroll,
		restoreScroll,
	}
}
