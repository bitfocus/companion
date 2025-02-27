import { CButton } from '@coreui/react'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useRef } from 'react'
import { AddEntitiesModal, AddEntitiesModalRef } from './AddEntitiesModal.js'
import { MyErrorBoundary } from '../../util.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { AddEntityDropdown } from './AddEntityDropdown.js'

interface AddEntityPanelProps {
	addEntity: (connectionId: string, definitionId: string) => void
	entityType: EntityModelType
	onlyFeedbackType: FeedbackEntitySubType | null
	entityTypeLabel: string
	readonly: boolean
}

export function AddEntityPanel({
	addEntity,
	entityType,
	onlyFeedbackType,
	entityTypeLabel,
	readonly,
}: AddEntityPanelProps) {
	const addEntitiesRef = useRef<AddEntitiesModalRef>(null)
	const showAddModal = useCallback(() => addEntitiesRef.current?.show(), [])

	return (
		<div className="add-dropdown-wrapper">
			<AddEntityDropdown
				onSelect={addEntity}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				onlyFeedbackType={onlyFeedbackType}
				disabled={readonly}
				showAll={entityType === EntityModelType.LocalVariable}
			/>
			{entityType !== EntityModelType.LocalVariable && (
				<>
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
							onlyFeedbackType={onlyFeedbackType}
							entityTypeLabel={entityTypeLabel}
						/>
					</MyErrorBoundary>
				</>
			)}
		</div>
	)
}
