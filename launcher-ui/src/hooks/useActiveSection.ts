import { useCallback, useEffect, useRef, useState } from 'react'

/** How far below the top of the window a section's heading counts as reached */
const ACTIVE_OFFSET = 96

interface SectionPosition {
	id: string
	/** The section's top, relative to the top of the window */
	top: number
}

/**
 * The section the reader is in: the last one whose top has scrolled up past `offset`. Once scrolled to the bottom it
 * is the last section, as that may be too short to ever reach the top.
 */
export function pickActiveSection(sections: SectionPosition[], offset: number, atBottom: boolean): string | null {
	if (sections.length === 0) return null
	if (atBottom) return sections[sections.length - 1].id

	let active = sections[0].id
	for (const section of sections) {
		if (section.top <= offset) active = section.id
	}
	return active
}

/**
 * Whether scrolling a section to the top would move the page: it moves by the section's distance from its scroll
 * position, but no further than the page can scroll either way.
 * @param scrollY - how far the page is scrolled now
 * @param distance - how far below its scroll position the section is (negative when above)
 * @param maxScrollY - the furthest the page can scroll (negative when it is shorter than the window)
 */
export function scrollWouldMove(scrollY: number, distance: number, maxScrollY: number): boolean {
	const target = Math.min(Math.max(scrollY + distance, 0), Math.max(maxScrollY, 0))
	return Math.abs(target - scrollY) >= 1
}

/**
 * Track which of the sections (by element id) the window is scrolled to, and scroll to one on request.
 * A requested section stays active until that scroll ends, even if the page can't scroll far enough to bring it to
 * the top.
 */
export function useActiveSection(ids: readonly string[]): [string | null, (id: string) => void] {
	const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)
	const scrollingToRef = useRef<string | null>(null)

	useEffect(() => {
		let frame = 0
		const update = () => {
			frame = 0
			if (scrollingToRef.current) return

			const sections = ids.map((id) => ({
				id,
				top: document.getElementById(id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
			}))
			// Only once scrolled: when everything fits in the window it is at the top, not the bottom
			const scrollHeight = document.documentElement.scrollHeight
			const atBottom = window.scrollY > 0 && window.innerHeight + window.scrollY >= scrollHeight - 2
			setActiveId(pickActiveSection(sections, ACTIVE_OFFSET, atBottom))
		}
		const scheduleUpdate = () => {
			if (!frame) frame = requestAnimationFrame(update)
		}
		const onScrollEnd = () => {
			scrollingToRef.current = null
		}

		update()
		window.addEventListener('scroll', scheduleUpdate, { passive: true })
		window.addEventListener('resize', scheduleUpdate)
		window.addEventListener('scrollend', onScrollEnd)
		return () => {
			if (frame) cancelAnimationFrame(frame)
			window.removeEventListener('scroll', scheduleUpdate)
			window.removeEventListener('resize', scheduleUpdate)
			window.removeEventListener('scrollend', onScrollEnd)
		}
	}, [ids])

	const scrollTo = useCallback((id: string) => {
		const element = document.getElementById(id)
		if (!element) return

		// Hold the requested section until the scroll ends. A request that won't move the page gets no scrollend, so
		// it must not hold it, or the next manual scroll could not update the active section
		const scrollMargin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0
		const distance = element.getBoundingClientRect().top - scrollMargin
		const maxScrollY = document.documentElement.scrollHeight - window.innerHeight
		scrollingToRef.current = scrollWouldMove(window.scrollY, distance, maxScrollY) ? id : null

		setActiveId(id)
		element.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}, [])

	return [activeId, scrollTo]
}
