import './PanelEmptyState.css'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createContext, useContext } from 'react'
import { Button } from '~/Components/Button.js'

export interface PanelEmptyListState {
	title: string
	description: string
	actionLabel: string
	onAction: () => void
}

const PanelEmptyListContext = createContext<PanelEmptyListState | null>(null)

export interface PanelEmptyListProviderProps {
	/** What to show instead while the page's list has nothing in it, or `null` while it does. */
	value: PanelEmptyListState | null
	children: React.ReactNode
}

/**
 * Provided by a page around its secondary panel's `<Outlet />`. The page owns the list and its add
 * action, while the empty state is rendered by the index route, so this is how the two meet.
 */
export function PanelEmptyListProvider({ value, children }: PanelEmptyListProviderProps): React.JSX.Element {
	return <PanelEmptyListContext.Provider value={value}>{children}</PanelEmptyListContext.Provider>
}

export interface PanelEmptyStateProps {
	icon: IconProp
	title: string
	description: string
}

/** What a SplitPanels secondary panel shows while nothing from the list is open in it. */
export function PanelEmptyState({ icon, title, description }: PanelEmptyStateProps): React.JSX.Element {
	const emptyList = useContext(PanelEmptyListContext)

	return (
		<div className="secondary-panel-simple-body no-scroll panel-empty-state">
			<div className="panel-empty-state-icon">
				<FontAwesomeIcon icon={icon} />
			</div>
			<h4 className="panel-empty-state-title">{emptyList?.title ?? title}</h4>
			<p className="panel-empty-state-description">{emptyList?.description ?? description}</p>
			{emptyList && (
				<Button color="primary" size="sm" className="mt-2" onClick={emptyList.onAction}>
					<FontAwesomeIcon icon={faPlus} className="me-1.5" />
					{emptyList.actionLabel}
				</Button>
			)}
		</div>
	)
}
