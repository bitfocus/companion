import { CButton } from '@coreui/react'
import { faFolderOpen, faPaste } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useContext, useRef } from 'react'
import { AddEntitiesModal, type AddEntitiesModalRef } from './AddEntitiesModal.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import type { EntityModelType, EntityOwner, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { AddEntityDropdown } from './AddEntityDropdown.js'
import { usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface AddEntityPanelProps {
	ownerId: EntityOwner | null
	entityType: EntityModelType
	feedbackListType: FeedbackEntitySubType | null
	entityTypeLabel: string
}

export const AddEntityPanel = observer(function AddEntityPanel({
	ownerId,
	entityType,
	feedbackListType,
	entityTypeLabel,
}: AddEntityPanelProps): React.JSX.Element {
	const { serviceFactory, readonly } = useEntityEditorContext()
	const { entityClipboard } = useContext(RootAppStoreContext)

	const addEntitiesRef = useRef<AddEntitiesModalRef>(null)
	const showAddModal = useCallback(() => addEntitiesRef.current?.show(), [])

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

	const canPaste = entityClipboard.copiedEntityType === entityType

	const handlePaste = useCallback(() => {
		const entity = entityClipboard.copiedEntity
		if (!entity) return
		serviceFactory.performPaste(ownerId, [entity])
	}, [entityClipboard, serviceFactory, ownerId])

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
			{canPaste && (
				<CButton
					color="success"
					onClick={handlePaste}
					disabled={readonly}
					title={`Paste ${entityTypeLabel} from clipboard`}
					style={{ marginLeft: 4 }}
				>
					<FontAwesomeIcon icon={faPaste} />
				</CButton>
			)}

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
})
