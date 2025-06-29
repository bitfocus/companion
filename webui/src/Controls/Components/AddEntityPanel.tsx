import { CButton } from '@coreui/react'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useRef } from 'react'
import { AddEntitiesModal, AddEntitiesModalRef } from './AddEntitiesModal.js'
import { MyErrorBoundary } from '~/util.js'
import { EntityModelType, EntityOwner, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { AddEntityDropdown } from './AddEntityDropdown.js'
import { IEntityEditorService } from '~/Services/Controls/ControlEntitiesService.js'
import { usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'

interface AddEntityPanelProps {
	serviceFactory: IEntityEditorService
	entityType: EntityModelType
	ownerId: EntityOwner | null
	feedbackListType: FeedbackEntitySubType | null
	entityTypeLabel: string
	readonly: boolean
}

export function AddEntityPanel({
	serviceFactory,
	entityType,
	ownerId,
	feedbackListType,
	entityTypeLabel,
	readonly,
}: AddEntityPanelProps): React.JSX.Element {
	const addEntitiesRef = useRef<AddEntitiesModalRef>(null)
	const showAddModal = useCallback(() => addEntitiesRef.current?.show(), [])

	const panelCollapseHelper = usePanelCollapseHelperContext()

	const addEntity = useCallback(
		(connectionId: string, definitionId: string) => {
			serviceFactory
				.addEntity(connectionId, definitionId, ownerId)
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
		[serviceFactory, ownerId, panelCollapseHelper]
	)

	return (
		<div className="add-dropdown-wrapper">
			<AddEntityDropdown
				onSelect={addEntity}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				feedbackListType={feedbackListType}
				disabled={readonly}
				showAll={false}
			/>
			<CButton
				color="primary"
				onClick={showAddModal}
				style={{
					borderTopLeftRadius: 0,
					borderBottomLeftRadius: 0,
				}}
				disabled={readonly}
			>
				<FontAwesomeIcon icon={faFolderOpen} />
			</CButton>

			<MyErrorBoundary>
				<AddEntitiesModal
					ref={addEntitiesRef}
					addEntity={addEntity}
					entityType={entityType}
					feedbackListType={feedbackListType}
					entityTypeLabel={entityTypeLabel}
				/>
			</MyErrorBoundary>
		</div>
	)
}
