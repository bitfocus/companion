import { useEffect, useMemo, useState } from 'react'

export default function useScrollPosition() {
	const [scrollPosition, setScrollPosition] = useState([0, 0])

	const [scrollerRef, setRef] = useState(null)

	useEffect(() => {
		if (scrollerRef) {
			setScrollPosition([scrollerRef.scrollLeft, scrollerRef.scrollTop])

			const onScroll = () => setScrollPosition([scrollerRef.scrollLeft, scrollerRef.scrollTop])

			scrollerRef.addEventListener('scroll', onScroll)

			return () => {
				scrollerRef.removeEventListener('scroll', onScroll)
			}
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
