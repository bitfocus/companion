import './PanelEmptyState.css'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export interface PanelEmptyStateProps {
	icon: IconDefinition
	title: string
	description: string
}

/** What a SplitPanels secondary panel shows while nothing from the list is open in it. */
export function PanelEmptyState({ icon, title, description }: PanelEmptyStateProps): React.JSX.Element {
	return (
		<div className="secondary-panel-simple-body no-scroll panel-empty-state">
			<div className="panel-empty-state-icon">
				<FontAwesomeIcon icon={icon} />
			</div>
			<h4 className="panel-empty-state-title">{title}</h4>
			<p className="panel-empty-state-description">{description}</p>
		</div>
	)
}
