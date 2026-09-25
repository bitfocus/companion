import { faAnglesDown, faAnglesUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import type { EntityOwner } from '@companion-app/shared/Model/EntityModel.js'
import { Button } from '~/Components/Button.js'
import { usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'
import { stringifyEntityOwnerId } from '../Util.js'

interface EntityEditorHeadingProps {
	heading: React.JSX.Element | string | null
	ownerId: EntityOwner | null
	childEntityIds: string[]
	headingActions?: React.JSX.Element[]
}

export const EntityEditorHeading = observer(function EntityEditorHeading({
	heading,
	ownerId,
	childEntityIds,
	headingActions,
}: EntityEditorHeadingProps) {
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const ownerIdString = stringifyEntityOwnerId(ownerId)

	if (!heading && (!headingActions || headingActions.length === 0)) return null

	return (
		<div className="entity-editor-heading flex items-center justify-between gap-2 my-2">
			<div className="entity-editor-heading-title text-sm font-semibold text-body">
				{heading}
				<span className="entity-editor-heading-count" aria-label={`${childEntityIds.length} items`}>
					{childEntityIds.length}
				</span>
			</div>

			<div className="entity-editor-heading-actions flex items-center gap-1 shrink-0">
				{childEntityIds.length >= 1 && panelCollapseHelper.canExpandAll(ownerIdString, childEntityIds) && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => panelCollapseHelper.setAllExpanded(ownerIdString, childEntityIds)}
						title="Expand all"
						className="text-muted hover:text-body text-xs px-2 py-0.5 flex items-center gap-1.5"
					>
						<FontAwesomeIcon icon={faAnglesDown} className="text-2xs" />
						<span className="text-3xs font-medium">Expand all</span>
					</Button>
				)}
				{childEntityIds.length >= 1 && panelCollapseHelper.canCollapseAll(ownerIdString, childEntityIds) && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => panelCollapseHelper.setAllCollapsed(ownerIdString, childEntityIds)}
						title="Collapse all"
						className="text-muted hover:text-body text-xs px-2 py-0.5 flex items-center gap-1.5"
					>
						<FontAwesomeIcon icon={faAnglesUp} className="text-2xs" />
						<span className="text-3xs font-medium">Collapse all</span>
					</Button>
				)}
				{headingActions || ''}
			</div>
		</div>
	)
})
