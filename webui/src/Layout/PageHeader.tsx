import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { useContext, useEffect } from 'react'
import { BetaBadge } from './BetaBadge.js'
import { ContextHelpButton, type ContextHelpButtonProps } from './PanelIcons.js'
import { useSidebarState } from './Sidebar.js'
import { TopBarPageContext } from './TopBarContext.js'

export interface PageHeaderProps {
	icon: IconDefinition
	title: string
	helpAction?: ContextHelpButtonProps['action']
	/** Marks the page as for something whose behaviour is not yet settled */
	beta?: boolean
}

/**
 * The title of a top-level page: icon + title + optional inline help. Inside the app frame the top bar shows it,
 * so this renders nothing there; a standalone page (outside the frame) gets it drawn in place instead.
 */
export function PageHeader({ icon, title, helpAction, beta }: PageHeaderProps): React.JSX.Element | null {
	const { mobileMode } = useSidebarState()
	const setTopBarPage = useContext(TopBarPageContext)

	useEffect(() => {
		if (!setTopBarPage) return

		setTopBarPage({ icon, title, helpAction, beta })
		return () => setTopBarPage(null)
	}, [setTopBarPage, icon, title, helpAction, beta])

	if (setTopBarPage) return null

	return (
		<div className={classNames('page-header', mobileMode && 'justify-center text-center')}>
			<div className={classNames('page-header-info', mobileMode && 'flex flex-col items-center')}>
				<h1 className={classNames('page-title', mobileMode && 'justify-center')}>
					<FontAwesomeIcon icon={icon} className="page-title-icon" />
					<span>{title}</span>
					{beta && <BetaBadge />}
					{helpAction && <ContextHelpButton action={helpAction} />}
				</h1>
			</div>
		</div>
	)
}
