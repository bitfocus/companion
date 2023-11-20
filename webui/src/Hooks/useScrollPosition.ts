import { useEffect, useMemo, useState } from 'react'

interface useScrollPositionResult<TElement extends HTMLElement> {
	scrollX: number
	scrollY: number
	setRef: (ref: TElement) => void
}

export default function useScrollPosition<TElement extends HTMLElement>(): useScrollPositionResult<TElement> {
	const [scrollPosition, setScrollPosition] = useState([0, 0])

	const [scrollerRef, setRef] = useState<TElement | null>(null)

	useEffect(() => {
		if (!scrollerRef) return

		setScrollPosition([scrollerRef.scrollLeft, scrollerRef.scrollTop])

		const onScroll = () => setScrollPosition([scrollerRef.scrollLeft, scrollerRef.scrollTop])

		scrollerRef.addEventListener('scroll', onScroll)

		return () => {
			scrollerRef.removeEventListener('scroll', onScroll)
		}
	}, [scrollerRef])

	return useMemo(
		() => ({
			scrollX: scrollPosition[0],
			scrollY: scrollPosition[1],
			setRef,
		}),
		[scrollPosition, setRef]
	)
}
