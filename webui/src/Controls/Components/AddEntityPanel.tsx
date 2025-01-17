import { CButton } from '@coreui/react'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useRef } from 'react'
import { AddEntitiesModal, AddEntitiesModalRef } from './AddEntitiesModal.js'
import { MyErrorBoundary } from '../../util.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { AddEntityDropdown } from './AddEntityDropdown.js'

interface AddEntityPanelProps {
	addEntity: (connectionId: string, definitionId: string) => void
	entityType: EntityModelType
	onlyFeedbackType: 'boolean' | 'advanced' | null
	entityTypeLabel: string
}

export function AddEntityPanel({ addEntity, entityType, onlyFeedbackType, entityTypeLabel }: AddEntityPanelProps) {
	const addEntitiesRef = useRef<AddEntitiesModalRef>(null)
	const showAddModal = useCallback(() => addEntitiesRef.current?.show(), [])

	return (
		<div className="add-dropdown-wrapper">
			<AddEntityDropdown
				onSelect={addEntity}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				onlyFeedbackType={onlyFeedbackType}
			/>
			<CButton
				color="primary"
				onClick={showAddModal}
				style={{
					borderTopLeftRadius: 0,
					borderBottomLeftRadius: 0,
				}}
			>
				<FontAwesomeIcon icon={faFolderOpen} />
			</CButton>

			<MyErrorBoundary>
				<AddEntitiesModal
					ref={addEntitiesRef}
					addEntity={addEntity}
					entityType={EntityModelType.Feedback}
					onlyFeedbackType={onlyFeedbackType}
					entityTypeLabel={entityTypeLabel}
				/>
			</MyErrorBoundary>
		</div>
	)
}
