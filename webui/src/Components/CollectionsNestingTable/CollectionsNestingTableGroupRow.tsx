import React, { useCallback, useState } from 'react'
import { CButton } from '@coreui/react'
import { faCaretRight, faCaretDown, faCheckCircle, faTrash, faPencilAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { TextInputField } from '../TextInputField.js'
import type { CollectionsNestingTableCollection, NestingCollectionsApi } from './Types.js'
import { CollectionsNestingTableCollectionRowWrapper } from './CollectionsNestingTableRowWrappers.js'

export interface CollectionsNestingTableCollectionRowProps {
	collection: CollectionsNestingTableCollection
	parentId: string | null
	index: number
	isCollapsed: boolean
	toggleExpanded: () => void
	collectionsApi: NestingCollectionsApi
	nestingLevel: number
}

export const CollectionsNestingTableCollectionRow = observer(function CollectionsNestingTableCollectionRow({
	collection,
	parentId,
	index,
	isCollapsed,
	toggleExpanded,
	collectionsApi,
	nestingLevel,
	children,
}: React.PropsWithChildren<CollectionsNestingTableCollectionRowProps>) {
	const [isEditing, setIsEditing] = useState(false)

	const toggleExpanded2 = useCallback(() => {
		if (isEditing) return
		toggleExpanded()
	}, [toggleExpanded, isEditing])

	const handleSetName = useCallback(
		(name: string) => collectionsApi.renameCollection(collection.id, name),
		[collectionsApi, collection.id]
	)

	const handleNameFieldBlur = useCallback(
		() =>
			// Delay to ensure if the check is clicked it doesn't fire twice
			setTimeout(() => {
				setIsEditing(false)
			}, 100),
		[]
	)

	const clickEditName = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		setIsEditing(true)
	}, [])

	const clickDeleteCollection = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			collectionsApi.deleteCollection(collection.id)
		},
		[collectionsApi, collection.id]
	)

	return (
		<CollectionsNestingTableCollectionRowWrapper
			collection={collection}
			parentId={parentId}
			index={index}
			nestingLevel={nestingLevel}
			isCollapsed={isCollapsed}
		>
			<div className="d-flex align-items-center justify-content-between" onClick={toggleExpanded2}>
				<div className="d-flex align-items-center flex-grow-1">
					{isEditing ? (
						<TextInputField
							value={collection.label ?? ''}
							placeholder={`Give this collection a name`}
							setValue={handleSetName}
							onBlur={handleNameFieldBlur}
							autoFocus
						/>
					) : (
						<>
							<FontAwesomeIcon icon={isCollapsed ? faCaretRight : faCaretDown} className="caret-icon me-1" />
							<span className="collection-name">{collection.label}</span>
						</>
					)}
				</div>
				<div className="d-flex align-items-center" onClick={(e) => e.stopPropagation()}>
					{children}

					{isEditing ? (
						<CButton color="link" onClick={handleNameFieldBlur}>
							<FontAwesomeIcon icon={faCheckCircle} />
						</CButton>
					) : (
						<CButton color="link" onClick={clickEditName}>
							<FontAwesomeIcon icon={faPencilAlt} />
						</CButton>
					)}

					<CButton color="link" onClick={clickDeleteCollection}>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</div>
			</div>
		</CollectionsNestingTableCollectionRowWrapper>
	)
})
