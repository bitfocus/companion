import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { ContextHelpButton, type ContextHelpButtonProps } from './PanelIcons.js'
import { useSidebarState } from './Sidebar.js'

export interface PageHeaderProps {
	icon?: IconDefinition
	title: string
	helpAction?: ContextHelpButtonProps['action']
	className?: string
}

/**
 * Consistent title block for top-level pages: icon + title + optional inline help. Use on every
 * primary page/route so the app has a predictable "where am I" now that there is no persistent app
 * header.
 */
export function PageHeader({ icon, title, helpAction, className }: PageHeaderProps): React.JSX.Element {
	const { mobileMode } = useSidebarState()

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
