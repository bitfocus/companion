import { faCompressArrowsAlt, faExpandArrowsAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import type { EntityOwner } from '@companion-app/shared/Model/EntityModel.js'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'
import { stringifyEntityOwnerId } from '../Util.js'

interface EntityEditorHeadingProps {
	heading: JSX.Element | string | null
	ownerId: EntityOwner | null
	childEntityIds: string[]
	headingActions?: JSX.Element[]
}

export const EntityEditorHeading = observer(function EntityEditorHeading({
	heading,
	ownerId,
	childEntityIds,
	headingActions,
}: EntityEditorHeadingProps) {
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const ownerIdString = stringifyEntityOwnerId(ownerId)

	return (
		<h5>
			{heading}&nbsp;
			<ButtonGroup className="right">
				{childEntityIds.length >= 1 && panelCollapseHelper.canExpandAll(ownerIdString, childEntityIds) && (
					<Button
						color="white"
						size="sm"
						onClick={() => panelCollapseHelper.setAllExpanded(ownerIdString, childEntityIds)}
						title="Expand all"
					>
						<FontAwesomeIcon icon={faExpandArrowsAlt} />
					</Button>
				)}
				{childEntityIds.length >= 1 && panelCollapseHelper.canCollapseAll(ownerIdString, childEntityIds) && (
					<Button
						color="white"
						size="sm"
						onClick={() => panelCollapseHelper.setAllCollapsed(ownerIdString, childEntityIds)}
						title="Collapse all"
					>
						<FontAwesomeIcon icon={faCompressArrowsAlt} />
					</Button>
				)}
				{headingActions || ''}
			</ButtonGroup>
		</h5>
	)
})
