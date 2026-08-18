/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames'
import { createContext, useContext, type HTMLAttributes } from 'react'

// The two-panel page layout: a list on the left and what it opens on the right, side by side once
// there is room and one at a time below that. The CSS lives in layout.css (`.split-panels`) — the
// breakpoint below must match the one the columns switch at there.

/**
 * Which panel to show while there is only room for one. `null` when the panels are not alternatives
 * to each other, and both should stay on show at every width.
 */
export type SplitPanelsShowing = 'primary' | 'secondary' | null

const ShowingContext = createContext<SplitPanelsShowing>(null)

export interface SplitPanelsRootProps extends HTMLAttributes<HTMLDivElement> {
	showing: SplitPanelsShowing
}

function SplitPanelsRoot({ showing, className, children, ...rest }: SplitPanelsRootProps): React.JSX.Element {
	return (
		<div className={classNames('split-panels', className)} {...rest}>
			<ShowingContext.Provider value={showing}>{children}</ShowingContext.Provider>
		</div>
	)
}

export type SplitPanelProps = HTMLAttributes<HTMLDivElement>

// The panels only ever *hide*, below the width at which both fit. Nothing sets a display for the
// visible state, so a panel keeps whatever its own classes give it (`.flex-column-layout`, say).
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
