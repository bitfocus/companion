import './PanelHeader.css'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export interface PanelHeaderProps {
	icon: IconProp
	title: string
	/** The header's buttons (help, close, …), right-aligned. */
	children: React.ReactNode
}

/** The heading row of a SplitPanels secondary panel card: an icon tile, a title, and its buttons. */
export function PanelHeader({ icon, title, children }: PanelHeaderProps): React.JSX.Element {
	return (
		<div className="secondary-panel-simple-header panel-header-compact">
			<div className="panel-header-title">
				<span className="panel-header-icon">
					<FontAwesomeIcon icon={icon} />
				</span>
				<h3 className="panel-header-heading">{title}</h3>
			</div>
			<div className="header-buttons">{children}</div>
		</div>
	)
}
