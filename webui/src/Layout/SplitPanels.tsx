/* eslint-disable react-refresh/only-export-components */
import './SplitPanels.css'
import classNames from 'classnames'
import { createContext, useCallback, useContext, useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { useResizeObserver } from '~/Hooks/useResizeObserver.js'

// The two-panel page layout: a list on the left and what it opens on the right, side by side once
// there is room and one at a time below that. The CSS lives in layout.css (`.split-panels`) — the
// breakpoint below must match the one the columns switch at there.

/**
 * Which panel to show while there is only room for one. `null` when the panels are not alternatives
 * to each other, and both should stay on show at every width.
 *
 * `'primary'` additionally means "nothing is open in the secondary panel", so the secondary is
 * collapsed at *every* width and the primary is given the whole split — a list page shows its list
 * full width until you open something from it.
 */
export type SplitPanelsShowing = 'primary' | 'secondary' | null

// Shared defaults so a view usually only has to name its `storageKey`; override per-view only when a
// page genuinely needs a different minimum or starting split.
export const SPLIT_PANELS_DEFAULT_MIN_PX = 400
export const SPLIT_PANELS_DEFAULT_PRIMARY_PERCENT = 50

/**
 * Opt a view into a draggable divide between the two panels (only takes effect in the side-by-side
 * layout). The chosen split is remembered per browser, keyed to `storageKey`, so each view keeps its
 * own width. Pass `null` on `Root` for the fixed half-and-half behaviour. Everything except
 * `storageKey` falls back to the shared `SPLIT_PANELS_DEFAULT_*` values when omitted.
 */
export interface SplitPanelsResizeConfig {
	/** Per-view localStorage key suffix, e.g. `image-library`. */
	storageKey: string
	/** Minimum width of the primary (left) panel, in px. Defaults to `SPLIT_PANELS_DEFAULT_MIN_PX`. */
	minPrimaryPx?: number
	/** Minimum width of the secondary (right) panel, in px. Defaults to `SPLIT_PANELS_DEFAULT_MIN_PX`. */
	minSecondaryPx?: number
	/** The primary panel's width as a percentage of the pair before the user drags. Defaults to `SPLIT_PANELS_DEFAULT_PRIMARY_PERCENT`. */
	defaultPrimaryPercent?: number
}

const ShowingContext = createContext<SplitPanelsShowing>(null)

export interface SplitPanelsRootProps extends HTMLAttributes<HTMLDivElement> {
	showing: SplitPanelsShowing
	resize: SplitPanelsResizeConfig | null
}

/**
 * Clamp a desired primary-panel width to the two panels' minimums and return it as a percentage of
 * the available width (the two panels together, excluding the gap). Pure so it can be unit-tested
 * without a DOM.
 */
export function clampPrimaryPercent(
	desiredPrimaryPx: number,
	availablePx: number,
	minPrimaryPx: number,
	minSecondaryPx: number
): number {
	const maxPrimaryPx = availablePx - minSecondaryPx
	const clampedPx = Math.min(Math.max(desiredPrimaryPx, minPrimaryPx), maxPrimaryPx)
	return (clampedPx / availablePx) * 100
}

function gridTemplateColumnsFor(minPrimaryPx: number, minSecondaryPx: number, primaryPercent: number): string {
	// `minmax` keeps the px minimums enforced by the browser even if a stored percent no longer fits
	// at a narrow (but still two-panel) width; the fr ratio otherwise splits by the stored percent.
	return `minmax(${minPrimaryPx}px, ${primaryPercent}fr) minmax(${minSecondaryPx}px, ${100 - primaryPercent}fr)`
}

function SplitPanelsRoot({
	showing,
	resize,
	className,
	children,
	style,
	...rest
}: SplitPanelsRootProps): React.JSX.Element {
	// A non-resizable view runs none of the resize hooks (media query, storage, observer): it stays as
	// cheap as it always was, and only the opted-in views pay for the extra machinery.
	if (resize) {
		return (
			<ResizableSplitPanelsRoot resize={resize} showing={showing} className={className} style={style} {...rest}>
				{children}
			</ResizableSplitPanelsRoot>
		)
	}

	return (
		<div
			className={classNames('split-panels', showing === 'primary' && 'split-panels-single', className)}
			style={style}
			{...rest}
		>
			<ShowingContext.Provider value={showing}>{children}</ShowingContext.Provider>
		</div>
	)
}

interface ResizableSplitPanelsRootProps extends HTMLAttributes<HTMLDivElement> {
	showing: SplitPanelsShowing
	resize: SplitPanelsResizeConfig
}

function ResizableSplitPanelsRoot({
	showing,
	resize,
	className,
	children,
	style,
	...rest
}: ResizableSplitPanelsRootProps): React.JSX.Element {
	const twoPanelMode = useTwoPanelMode()
	// Nothing to drag while the secondary panel is collapsed: the primary has the whole split, and the
	// stored percent is left untouched so it comes back as it was when something is opened again.
	const collapsed = showing === 'primary'
	const resizable = twoPanelMode && !collapsed

	const minPrimaryPx = resize.minPrimaryPx ?? SPLIT_PANELS_DEFAULT_MIN_PX
	const minSecondaryPx = resize.minSecondaryPx ?? SPLIT_PANELS_DEFAULT_MIN_PX
	const defaultPrimaryPercent = resize.defaultPrimaryPercent ?? SPLIT_PANELS_DEFAULT_PRIMARY_PERCENT

	const [primaryPercent, setPrimaryPercent] = useLocalStorage<number>(
		`split-panels-width:${resize.storageKey}`,
		defaultPrimaryPercent
	)

	const rootRef = useRef<HTMLDivElement | null>(null)
	const handleRef = useRef<HTMLDivElement | null>(null)

	// Sit the handle at the boundary between the panels, centred in the column gap. Measured rather
	// than computed so the gap + left-padding box model never has to be reproduced in CSS.
	const positionHandle = useCallback(() => {
		const root = rootRef.current
		const handle = handleRef.current
		if (!root || !handle) return
		const primary = root.querySelector(':scope > .primary-panel')
		const secondary = root.querySelector(':scope > .secondary-panel')
		if (!primary || !secondary) return
		const rootRect = root.getBoundingClientRect()
		const primaryRect = primary.getBoundingClientRect()
		const secondaryRect = secondary.getBoundingClientRect()
		const gap = secondaryRect.left - primaryRect.right
		handle.style.left = `${primaryRect.right - rootRect.left + gap / 2}px`
	}, [])

	useLayoutEffect(() => {
		if (resizable) positionHandle()
	}, [resizable, primaryPercent, positionHandle])

	useResizeObserver({ ref: rootRef, onResize: () => resizable && positionHandle() })

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const root = rootRef.current
			if (!root) return
			const primary = root.querySelector(':scope > .primary-panel')
			const secondary = root.querySelector(':scope > .secondary-panel')
			if (!primary || !secondary) return

			e.preventDefault()

			const primaryRect = primary.getBoundingClientRect()
			const available = primaryRect.width + secondary.getBoundingClientRect().width
			const startX = e.clientX
			const startPrimaryW = primaryRect.width
			const handleEl = e.currentTarget
			let latestPercent = primaryPercent

			const onMove = (ev: PointerEvent) => {
				latestPercent = clampPrimaryPercent(
					startPrimaryW + (ev.clientX - startX),
					available,
					minPrimaryPx,
					minSecondaryPx
				)
				root.style.gridTemplateColumns = gridTemplateColumnsFor(minPrimaryPx, minSecondaryPx, latestPercent)
				positionHandle()
			}
			const onUp = () => {
				handleEl.releasePointerCapture(e.pointerId)
				handleEl.removeEventListener('pointermove', onMove)
				handleEl.removeEventListener('pointerup', onUp)
				setPrimaryPercent(latestPercent)
			}

			handleEl.setPointerCapture(e.pointerId)
			handleEl.addEventListener('pointermove', onMove)
			handleEl.addEventListener('pointerup', onUp)
		},
		[minPrimaryPx, minSecondaryPx, primaryPercent, positionHandle, setPrimaryPercent]
	)

	const handleDoubleClick = useCallback(() => {
		setPrimaryPercent(defaultPrimaryPercent)
	}, [defaultPrimaryPercent, setPrimaryPercent])

	const primaryPercentSafe = Number.isFinite(primaryPercent) ? primaryPercent : defaultPrimaryPercent

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			let delta = 0
			if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
				delta = e.shiftKey ? -10 : -2
			} else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
				delta = e.shiftKey ? 10 : 2
			} else if (e.key === 'Home') {
				e.preventDefault()
				setPrimaryPercent(20)
				return
			} else if (e.key === 'End') {
				e.preventDefault()
				setPrimaryPercent(80)
				return
			} else if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				setPrimaryPercent(defaultPrimaryPercent)
				return
			} else {
				return
			}

			e.preventDefault()
			const newPercent = Math.min(80, Math.max(20, primaryPercentSafe + delta))
			setPrimaryPercent(newPercent)
		},
		[primaryPercentSafe, defaultPrimaryPercent, setPrimaryPercent]
	)

	const mergedStyle = resizable
		? { ...style, gridTemplateColumns: gridTemplateColumnsFor(minPrimaryPx, minSecondaryPx, primaryPercentSafe) }
		: style

	return (
		<div
			ref={rootRef}
			className={classNames(
				'split-panels',
				collapsed && 'split-panels-single',
				resizable && 'split-panels-resizable',
				className
			)}
			style={mergedStyle}
			{...rest}
		>
			<ShowingContext.Provider value={showing}>{children}</ShowingContext.Provider>
			{resizable && (
				<div
					ref={handleRef}
					className="split-panels-resize-handle"
					onPointerDown={handlePointerDown}
					onDoubleClick={handleDoubleClick}
					onKeyDown={handleKeyDown}
					role="separator"
					tabIndex={0}
					aria-orientation="vertical"
					aria-label="Resize panel split"
					aria-valuenow={Math.round(primaryPercentSafe)}
					aria-valuemin={20}
					aria-valuemax={80}
				/>
			)}
		</div>
	)
}

export type SplitPanelProps = HTMLAttributes<HTMLDivElement>

// The panels only ever *hide* — the secondary whenever nothing is open in it, the primary below the
// width at which both fit. Nothing sets a display for the visible state, so a panel keeps whatever
// its own classes give it (`.flex-column-layout`, say).
function SplitPanelsPrimary({ className, ...rest }: SplitPanelProps): React.JSX.Element {
	const showing = useContext(ShowingContext)

	return (
		<div className={classNames('primary-panel', showing === 'secondary' && 'max-xl:hidden', className)} {...rest} />
	)
}

function SplitPanelsSecondary({ className, ...rest }: SplitPanelProps): React.JSX.Element {
	const showing = useContext(ShowingContext)

	return <div className={classNames('secondary-panel', showing === 'primary' && 'hidden', className)} {...rest} />
}

export const SplitPanels = {
	Root: SplitPanelsRoot,
	Primary: SplitPanelsPrimary,
	Secondary: SplitPanelsSecondary,
}
