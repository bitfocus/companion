import { CButton } from '@coreui/react'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useRef } from 'react'
import { AddFeedbackDropdown } from './AddFeedbackDropdown.js'
import { AddEntitiesModal, AddEntitiesModalRef } from './AddEntitiesModal.js'
import { assertNever, MyErrorBoundary } from '../../util.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { AddActionDropdown } from './AddActionDropdown.js'

interface AddEntityPanelProps {
	addEntity: (connectionId: string, definitionId: string) => void
	entityType: EntityModelType
	onlyFeedbackType: 'boolean' | 'advanced' | null
	entityTypeLabel: string
}

export function AddEntityPanel({ addEntity, entityType, onlyFeedbackType, entityTypeLabel }: AddEntityPanelProps) {
	const addEntitiesRef = useRef<AddEntitiesModalRef>(null)
	const showAddModal = useCallback(() => addEntitiesRef.current?.show(), [])

	let addDropdown: JSX.Element | null = null
	switch (entityType) {
		case EntityModelType.Action:
			addDropdown = (
				<AddActionDropdown
					onSelect={addEntity}
					// onlyType={onlyFeedbackType}
					addPlaceholder={`+ Add ${entityTypeLabel}`}
				/>
			)
			break
		case EntityModelType.Feedback:
			addDropdown = (
				<AddFeedbackDropdown
					onSelect={addEntity}
					onlyType={onlyFeedbackType}
					addPlaceholder={`+ Add ${entityTypeLabel}`}
				/>
			)
			break
		default:
			assertNever(entityType)
			break
	}

	return (
		<div className="add-dropdown-wrapper">
			{addDropdown}
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
