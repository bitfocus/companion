import { useEffect, useRef } from 'react'
import { useSectionVisibility } from '../contexts/SectionVisibilityContext.js'

interface UseSectionVisibilityObserverProps {
	sectionId: string
	rootMargin?: string
	threshold?: number
}

export function useSectionVisibilityObserver({
	sectionId,
	rootMargin = '-20% 0px -60% 0px',
	threshold = 0,
}: UseSectionVisibilityObserverProps): React.RefObject<HTMLDivElement> {
	const elementRef = useRef<HTMLDivElement>(null)
	const { addVisibleSection, removeVisibleSection } = useSectionVisibility()

	useEffect(() => {
		const element = elementRef.current
		if (!element) return

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						addVisibleSection(sectionId)
					} else {
						removeVisibleSection(sectionId)
					}
				})
			},
			{
				rootMargin,
				threshold,
			}
		)

		observer.observe(element)

		return () => {
			observer.unobserve(element)
			removeVisibleSection(sectionId)
		}
	}, [sectionId, addVisibleSection, removeVisibleSection, rootMargin, threshold])

	return elementRef
}
