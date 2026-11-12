import './PageEmptyState.css'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export interface PageEmptyStateProps {
	icon: IconDefinition
	title: string
	description: React.ReactNode
	/** The buttons inviting the user to create the first item. */
	actions: React.ReactNode
}

/** What a list page shows in place of its usual layout while it has nothing in it. */
export function PageEmptyState({ icon, title, description, actions }: PageEmptyStateProps): React.JSX.Element {
	return (
		<div className="page-empty-state">
			<div className="page-empty-state-content">
				<div className="page-empty-state-icon">
					<FontAwesomeIcon icon={icon} />
				</div>
				<h3 className="page-empty-state-title">{title}</h3>
				<div className="page-empty-state-description">{description}</div>
				<div className="page-empty-state-actions">{actions}</div>
			</div>
		</div>
	)
}
