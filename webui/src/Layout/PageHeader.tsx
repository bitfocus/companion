import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { useContext, useEffect } from 'react'
import { ContextHelpButton, type ContextHelpButtonProps } from './PanelIcons.js'
import { useSidebarState } from './Sidebar.js'
import { TopBarPageContext } from './TopBarContext.js'

export interface PageHeaderProps {
	icon?: IconDefinition
	title: string
	helpAction?: ContextHelpButtonProps['action']
	className?: string
}

/**
 * The title of a top-level page: icon + title + optional inline help. Inside the app frame the top bar shows it,
 * so this renders nothing there; a standalone page (outside the frame) gets it drawn in place instead.
 */
export function PageHeader({ icon, title, helpAction, className }: PageHeaderProps): React.JSX.Element | null {
	const { mobileMode } = useSidebarState()
	const setTopBarPage = useContext(TopBarPageContext)

	useEffect(() => {
		if (!setTopBarPage) return

		setTopBarPage({ icon, title, helpAction })
		return () => setTopBarPage(null)
	}, [setTopBarPage, icon, title, helpAction])

	if (setTopBarPage) return null

	return (
		<div className={classNames('page-header', mobileMode && 'justify-center text-center', className)}>
			<div className={classNames('page-header-info', mobileMode && 'flex flex-col items-center')}>
				<h1 className={classNames('page-title', mobileMode && 'justify-center')}>
					{icon && <FontAwesomeIcon icon={icon} className="page-title-icon" />}
					<span>{title}</span>
					{helpAction && <ContextHelpButton action={helpAction} />}
				</h1>
			</div>
		</div>
	)
}
