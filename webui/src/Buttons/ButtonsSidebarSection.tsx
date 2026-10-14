import classNames from 'classnames'
import './ButtonsSidebarSection.css'

interface ButtonsSidebarSectionProps {
	className: string | undefined
	title: string
	/** Controls beside the title, e.g. an add button */
	actions: React.ReactNode | null
	children: React.ReactNode
}

/** One tab's content in the Buttons page sidebar: a small heading, then the section itself. */
export function ButtonsSidebarSection({
	className,
	title,
	actions,
	children,
}: ButtonsSidebarSectionProps): React.JSX.Element {
	return (
		<div className={classNames('buttons-sidebar-section', className)}>
			<div className={classNames('buttons-sidebar-heading-row', { 'buttons-sidebar-heading-row-actions': !!actions })}>
				<h5 className="buttons-sidebar-heading">{title}</h5>
				{actions}
			</div>
			{children}
		</div>
	)
}
