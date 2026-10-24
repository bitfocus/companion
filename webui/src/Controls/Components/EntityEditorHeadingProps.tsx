import { faAnglesDown, faAnglesUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
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
	subheading?: React.JSX.Element | string | null
}

export const EntityEditorHeading = observer(function EntityEditorHeading({
	heading,
	ownerId,
	childEntityIds,
	headingActions,
	subheading,
}: EntityEditorHeadingProps) {
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const ownerIdString = stringifyEntityOwnerId(ownerId)

	const canExpandAll = childEntityIds.length >= 1 && panelCollapseHelper.canExpandAll(ownerIdString, childEntityIds)
	const canCollapseAll = childEntityIds.length >= 1 && panelCollapseHelper.canCollapseAll(ownerIdString, childEntityIds)
	const hasActions = !!headingActions && headingActions.length > 0

	// A list without a title (page variables, unlabelled child groups) still gets its expand/collapse controls
	const showHeadingRow = !!heading || hasActions || canExpandAll || canCollapseAll
	if (!showHeadingRow && !subheading) return null

	return (
		<>
			{showHeadingRow && (
				<div
					className={classNames('entity-editor-heading flex items-center justify-between gap-2 my-2', {
						'mb-0': !!subheading,
					})}
				>
					<div className="entity-editor-heading-title text-base font-semibold text-body">{heading}</div>

					<div className="entity-editor-heading-actions flex items-center gap-1 shrink-0">
						{canExpandAll && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => panelCollapseHelper.setAllExpanded(ownerIdString, childEntityIds)}
								title="Expand all"
								className="text-xs px-2 py-0.5 flex items-center gap-1.5"
							>
								<FontAwesomeIcon icon={faAnglesDown} className="text-2xs" />
								<span className="text-3xs font-medium">Expand all</span>
							</Button>
						)}
						{canCollapseAll && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => panelCollapseHelper.setAllCollapsed(ownerIdString, childEntityIds)}
								title="Collapse all"
								className="text-xs px-2 py-0.5 flex items-center gap-1.5"
							>
								<FontAwesomeIcon icon={faAnglesUp} className="text-2xs" />
								<span className="text-3xs font-medium">Collapse all</span>
							</Button>
						)}
						{headingActions || ''}
					</div>
				</div>
			)}

			{subheading && <div className="mb-2">{subheading}</div>}
		</>
	)
})
