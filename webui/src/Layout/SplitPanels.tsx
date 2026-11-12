/* eslint-disable react-refresh/only-export-components */
import './SplitPanels.css'
import classNames from 'classnames'
import { createContext, useContext, type HTMLAttributes } from 'react'
import { ResizeHandle } from '~/Components/ResizeHandle.js'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode.js'
import { useSplitResize } from '~/Hooks/useSplitResize.js'
import { PageEmptyState, type PageEmptyStateProps } from './PageEmptyState.js'

// The two-panel page layout: a list on the left and what it opens on the right, side by side once
// there is room and one at a time below that. The CSS lives in layout.css (`.split-panels`) — the
// breakpoint below must match the one the columns switch at there.

/**
 * Which panel to show while there is only room for one. `null` when the panels are not alternatives
 * to each other, and both should stay on show at every width.
 *
 * Once both fit, both are always shown, whichever this is: the secondary shows its empty state while
 * nothing is open in it, rather than collapsing, so opening something never reflows the primary.
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
	/**
	 * Shown in place of both panels while the page's list is empty and nothing is open, inviting the user
	 * to create the first item. `null` for the usual split.
	 */
	empty: PageEmptyStateProps | null
}

function SplitPanelsRoot({
	showing,
	resize,
	empty,
	className,
	children,
	style,
	...rest
}: SplitPanelsRootProps): React.JSX.Element {
	if (empty) return <PageEmptyState {...empty} />

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
		<div className={classNames('split-panels', className)} style={style} {...rest}>
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
	const resizable = useTwoPanelMode()

	const { rootRef, rootStyle, handleProps } = useSplitResize({
		orientation: 'horizontal',
		enabled: resizable,
		storageKey: `split-panels-width:${resize.storageKey}`,
		panelSelectors: ['.primary-panel', '.secondary-panel'],
		minFirstPx: resize.minPrimaryPx ?? SPLIT_PANELS_DEFAULT_MIN_PX,
		minSecondPx: resize.minSecondaryPx ?? SPLIT_PANELS_DEFAULT_MIN_PX,
		defaultFirstPercent: resize.defaultPrimaryPercent ?? SPLIT_PANELS_DEFAULT_PRIMARY_PERCENT,
	})

	return (
		<div
			ref={rootRef}
			className={classNames('split-panels', resizable && 'split-panels-resizable', className)}
			style={rootStyle ? { ...style, ...rootStyle } : style}
			{...rest}
		>
			<ShowingContext.Provider value={showing}>{children}</ShowingContext.Provider>
			{resizable && <ResizeHandle {...handleProps} />}
		</div>
	)
}

export type SplitPanelProps = HTMLAttributes<HTMLDivElement>

// The panels only ever *hide*, and only below the width at which both fit. Nothing sets a display for
// the visible state, so a panel keeps whatever its own classes give it (`.flex-column-layout`, say).
function SplitPanelsPrimary({ className, ...rest }: SplitPanelProps): React.JSX.Element {
	const showing = useContext(ShowingContext)

	return (
		<div className={classNames('primary-panel', showing === 'secondary' && 'max-xl:hidden', className)} {...rest} />
	)
}

function SplitPanelsSecondary({ className, ...rest }: SplitPanelProps): React.JSX.Element {
	const showing = useContext(ShowingContext)

	return (
		<div className={classNames('secondary-panel', showing === 'primary' && 'max-xl:hidden', className)} {...rest} />
	)
}

export const SplitPanels = {
	Root: SplitPanelsRoot,
	Primary: SplitPanelsPrimary,
	Secondary: SplitPanelsSecondary,
}
