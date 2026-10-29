import { observer } from 'mobx-react-lite'
import type { EntityOwner } from '@companion-app/shared/Model/EntityModel.js'
import { ListHeading } from '~/Components/ListHeading.js'
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

	// Only offered alongside a heading, which is where they are shown
	const offerCollapse = !!heading || (!!headingActions && headingActions.length > 0)

	return (
		<ListHeading
			heading={heading}
			subheading={subheading}
			actions={headingActions}
			collapse={
				offerCollapse && childEntityIds.length >= 1
					? {
							canExpandAll: panelCollapseHelper.canExpandAll(ownerIdString, childEntityIds),
							canCollapseAll: panelCollapseHelper.canCollapseAll(ownerIdString, childEntityIds),
							expandAll: () => panelCollapseHelper.setAllExpanded(ownerIdString, childEntityIds),
							collapseAll: () => panelCollapseHelper.setAllCollapsed(ownerIdString, childEntityIds),
						}
					: null
			}
		/>
	)
})
