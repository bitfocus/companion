import { EntityOwner } from '@companion-app/shared/Model/EntityModel.js'
import { CButtonGroup, CButton } from '@coreui/react'
import { faExpandArrowsAlt, faCompressArrowsAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'
import { stringifyEntityOwnerId } from '../Util.js'
import { observer } from 'mobx-react-lite'

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
			{heading}

			<CButtonGroup className="right">
				{childEntityIds.length >= 1 && panelCollapseHelper.canExpandAll(ownerIdString, childEntityIds) && (
					<CButton
						color="white"
						size="sm"
						onClick={() => panelCollapseHelper.setAllExpanded(ownerIdString, childEntityIds)}
						title="Expand all"
					>
						<FontAwesomeIcon icon={faExpandArrowsAlt} />
					</CButton>
				)}
				{childEntityIds.length >= 1 && panelCollapseHelper.canCollapseAll(ownerIdString, childEntityIds) && (
					<CButton
						color="white"
						size="sm"
						onClick={() => panelCollapseHelper.setAllCollapsed(ownerIdString, childEntityIds)}
						title="Collapse all"
					>
						<FontAwesomeIcon icon={faCompressArrowsAlt} />
					</CButton>
				)}
				{headingActions || ''}
			</CButtonGroup>
		</h5>
	)
})
