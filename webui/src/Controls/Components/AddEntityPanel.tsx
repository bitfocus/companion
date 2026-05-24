import { useCallback } from 'react'
import type { EntityModelType, EntityOwner, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { AddEntitiesModal } from './AddEntitiesModal.js'
import { AddEntityDropdown } from './AddEntityDropdown.js'
import { useEntityEditorContext } from './EntityEditorContext.js'

interface AddEntityPanelProps {
	ownerId: EntityOwner | null
	entityType: EntityModelType
	feedbackListType: FeedbackEntitySubType | null
	entityTypeLabel: string
}

export function AddEntityPanel({
	ownerId,
	entityType,
	feedbackListType,
	entityTypeLabel,
}: AddEntityPanelProps): React.JSX.Element {
	const { serviceFactory, readonly } = useEntityEditorContext()

	const panelCollapseHelper = usePanelCollapseHelperContext()

	const addEntity = useCallback(
		(connectionId: string, definitionId: string) => {
			serviceFactory
				.addEntity(connectionId, entityType, definitionId, ownerId)
				.then((newId) => {
					if (newId) {
						// Make sure the panel is open and wont be forgotten on first render
						setTimeout(() => panelCollapseHelper.setPanelCollapsed(newId, false), 10)
					}
				})
				.catch((e) => {
					console.error('Failed to add entity', e)
				})
		},
		[serviceFactory, entityType, ownerId, panelCollapseHelper]
	)

	return (
		<div className="add-dropdown-wrapper">
			<AddEntityDropdown
				onSelect={addEntity}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				feedbackListType={feedbackListType}
				disabled={readonly}
			/>

			<MyErrorBoundary>
				<AddEntitiesModal
					addEntity={addEntity}
					entityType={entityType}
					feedbackListType={feedbackListType}
					entityTypeLabel={entityTypeLabel}
					disabled={readonly}
				/>
			</MyErrorBoundary>
		</div>
	)
}
