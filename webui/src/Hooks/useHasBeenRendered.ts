import { useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'

export function useHasBeenRendered(): [hasBeenInView: boolean, ref: (node: Element | null | undefined) => void] {
	// Track whether this tab has been rendered, to allow lazy rendering of the grid component
	const { ref, inView } = useInView()
	const [hasBeenInView, setHasBeenInView] = useState(false)
	useEffect(() => {
		if (inView) setHasBeenInView(true)
	}, [inView])

	return [hasBeenInView, ref]
}
