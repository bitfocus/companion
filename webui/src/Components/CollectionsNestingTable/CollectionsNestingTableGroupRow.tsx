import { faCaretDown, faCaretRight, faCheckCircle, faPencilAlt, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useState } from 'react'
import { Button } from '~/Components/Button'
import { TextInputFieldSimple } from '../TextInputField.js'
import { CollectionsNestingTableCollectionRowWrapper } from './CollectionsNestingTableRowWrappers.js'
import type { CollectionsNestingTableCollection, NestingCollectionsApi } from './Types.js'

export interface CollectionsNestingTableCollectionRowProps {
	collection: CollectionsNestingTableCollection
	parentId: string | null
	index: number
	isCollapsed: boolean
	toggleExpanded: () => void
	collectionsApi: NestingCollectionsApi | undefined
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
		(name: string) => collectionsApi?.renameCollection(collection.id, name),
		[collectionsApi, collection.id]
	)

	const handleNameFieldBlur = useCallback(() => setIsEditing(false), [])

	const handleNameFieldKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			setIsEditing(false)
		}
	}, [])

	const clickEditName = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		setIsEditing(true)
	}, [])

	const clickDeleteCollection = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			collectionsApi?.deleteCollection(collection.id)
		},
		[collectionsApi, collection.id]
	)

	return (
		<CollectionsNestingTableCollectionRowWrapper
			collection={collection}
			parentId={parentId}
			index={index}
			nestingLevel={nestingLevel}
		>
			<div className="flex items-center justify-between" onClick={toggleExpanded2}>
				<div className="flex items-center grow">
					{isEditing ? (
						<TextInputFieldSimple
							id={undefined}
							className="collection-name-input"
							value={collection.label ?? ''}
							placeholder={`Give this collection a name`}
							setValue={handleSetName}
							onBlur={handleNameFieldBlur}
							onKeyDown={handleNameFieldKeyDown}
							autoFocus
						/>
					) : (
						<>
							<FontAwesomeIcon icon={isCollapsed ? faCaretRight : faCaretDown} className="caret-icon me-1" />
							<span className="collection-name">{collection.label}</span>
						</>
					)}
				</div>
				<div className="flex items-center" onClick={(e) => e.stopPropagation()}>
					{children}

					{!!collectionsApi && (
						<>
							{isEditing ? (
								<Button
									color="secondary"
									title="Finish renaming collection"
									// Keep the input focused until click, so blur cannot replace this button with the pencil.
									onPointerDown={(e) => {
										if (e.button === 0) e.preventDefault()
									}}
									onClick={handleNameFieldBlur}
									variant="ghost"
								>
									<FontAwesomeIcon icon={faCheckCircle} />
								</Button>
							) : (
								<Button color="secondary" title="Rename collection" onClick={clickEditName} variant="ghost">
									<FontAwesomeIcon icon={faPencilAlt} />
								</Button>
							)}

							<Button color="danger" onClick={clickDeleteCollection} variant="ghost">
								<FontAwesomeIcon icon={faTrash} />
							</Button>
						</>
					)}
				</div>
			</div>
		</CollectionsNestingTableCollectionRowWrapper>
	)
})
