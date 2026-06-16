import { useCallback, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { useResizeObserver } from 'usehooks-ts'
import { useEntityListHeightCache } from '~/Controls/Components/EntityListHeightCacheContext.js'

export interface LazyMountWithHeight {
	/** Attach to the element whose mounting is gated and whose height should be measured. */
	setRef: (node: HTMLDivElement | null) => void
	/** Whether the expensive content should currently be rendered. */
	shouldMount: boolean
	/** Height (px) to reserve while the content is not mounted, to keep scrolling stable. */
	placeholderHeight: number
}

/**
 * Gate the mounting of an expensive element on viewport visibility, while reserving its
 * last-measured height when unmounted so the scroll position stays stable.
 *
 * @param entityId stable id used to cache the exact measured height
 * @param defKey definition key (connection + type + definitionId) used to estimate the height of
 *   never-rendered rows from other rows of the same definition
 * @param disableLazyMount force the content to always be mounted (e.g. in a drag preview)
 */
export function useLazyMountWithHeight(
	entityId: string,
	defKey: string,
	disableLazyMount: boolean
): LazyMountWithHeight {
	const cache = useEntityListHeightCache()

	// Mount slightly before the row scrolls into view so its height is measured just ahead of the scroll.
	const { ref: inViewRef, inView } = useInView({ rootMargin: '600px 0px', initialInView: disableLazyMount })
	const shouldMount = disableLazyMount || inView

	// Track current mount state for the (stable) ResizeObserver callback, so we only record the
	// height of real content and never of the reserved-height placeholder.
	const shouldMountRef = useRef(shouldMount)
	shouldMountRef.current = shouldMount

	const measureRef = useRef<HTMLDivElement | null>(null)
	useResizeObserver({
		ref: measureRef,
		box: 'border-box',
		onResize: ({ height }) => {
			if (height && shouldMountRef.current) cache.set(entityId, defKey, height)
		},
	})

	const setRef = useCallback(
		(node: HTMLDivElement | null) => {
			measureRef.current = node
			inViewRef(node)
		},
		[inViewRef]
	)

	return {
		setRef,
		shouldMount,
		placeholderHeight: cache.estimate(entityId, defKey),
	}
}
