import { CButton } from '@coreui/react'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useRef } from 'react'
import { AddFeedbackDropdown } from './AddFeedbackDropdown.js'
import { AddEntitiesModal, AddEntitiesModalRef } from './AddModal.js'
import { MyErrorBoundary } from '../util.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

interface AddFeedbackPanelProps {
	addFeedback: (connectionId: string, definitionId: string) => void
	onlyType: 'boolean' | 'advanced' | null
	entityTypeLabel: string
}

export function AddFeedbackPanel({ addFeedback, onlyType, entityTypeLabel }: AddFeedbackPanelProps) {
	const addFeedbacksRef = useRef<AddEntitiesModalRef>(null)
	const showAddModal = useCallback(() => addFeedbacksRef.current?.show(), [])

	return (
		<div className="add-dropdown-wrapper">
			<AddFeedbackDropdown onSelect={addFeedback} onlyType={onlyType} addPlaceholder={`+ Add ${entityTypeLabel}`} />
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
					ref={addFeedbacksRef}
					addEntity={addFeedback}
					entityType={EntityModelType.Feedback}
					onlyFeedbackType={onlyType}
					entityTypeLabel={entityTypeLabel}
				/>
			</MyErrorBoundary>
		</div>
	)
}
