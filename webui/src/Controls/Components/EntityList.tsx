import { observer } from 'mobx-react-lite'
import { useRef } from 'react'
import { useResizeObserver } from 'usehooks-ts'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { EntityModelType, EntityOwner, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { AddEntityPanel } from './AddEntityPanel.js'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { EntityEditorHeading } from './EntityEditorHeadingProps.js'
import { EntityTableRow } from './EntityEditorRow.js'
import { EntityDropPlaceholderZone } from './EntityListDropZone.js'
import { EntityListHeightCacheProvider, useEntityListHeightCache } from './EntityListHeightCacheContext.js'

interface EditableEntityListProps {
	heading: JSX.Element | string | null
	headingActions?: JSX.Element[]
	subheading?: JSX.Element | string | null
	entities: SomeEntityModel[] | undefined
	ownerId: EntityOwner | null
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}
export const EditableEntityList = observer(function EditableEntityList({
	heading,
	headingActions,
	subheading,
	entities,
	ownerId,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: EditableEntityListProps) {
	return (
		<>
			<EntityEditorHeading
				heading={heading}
				ownerId={ownerId}
				childEntityIds={entities?.map((f) => f.id) ?? []}
				headingActions={headingActions}
			/>

			{subheading}

			<MinimalEntityList
				ownerId={ownerId}
				entityType={entityType}
				entityTypeLabel={entityTypeLabel}
				feedbackListType={feedbackListType}
				entities={entities}
			/>
			<AddEntityPanel
				ownerId={ownerId}
				entityType={entityType}
				feedbackListType={feedbackListType}
				entityTypeLabel={entityTypeLabel}
			/>
		</>
	)
})

interface MinimalEntityListProps {
	ownerId: EntityOwner | null
	entities: SomeEntityModel[] | undefined
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
}

export const MinimalEntityList = observer(function MinimalEntityList(props: MinimalEntityListProps) {
	return (
		<EntityListHeightCacheProvider>
			<MinimalEntityListContents {...props} />
		</EntityListHeightCacheProvider>
	)
})

const MinimalEntityListContents = observer(function MinimalEntityListContents({
	ownerId,
	entities,
	entityType,
	entityTypeLabel,
	feedbackListType,
}: MinimalEntityListProps) {
	const { controlId } = useEntityEditorContext()
	const dragId = `${controlId}_${entityType}`

	// Cached row heights become stale when the list width changes (option fields reflow), so drop
	// them on a width change. Mounted rows re-measure immediately; placeholders correct on scroll-in.
	const heightCache = useEntityListHeightCache()
	const listRef = useRef<HTMLDivElement>(null)
	const lastWidthRef = useRef<number | undefined>(undefined)
	useResizeObserver({
		ref: listRef,
		box: 'border-box',
		onResize: ({ width }) => {
			if (width == null) return
			if (lastWidthRef.current != null && Math.abs(lastWidthRef.current - width) > 1) {
				heightCache.clear()
			}
			lastWidthRef.current = width
		},
	})

	return (
		<>
			<div className="entity-list" ref={listRef}>
				{entities &&
					entities.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<EntityTableRow
								key={a?.id ?? i}
								ownerId={ownerId}
								entity={a}
								index={i}
								dragId={dragId}
								entityType={entityType}
								entityTypeLabel={entityTypeLabel}
								feedbackListType={feedbackListType}
							/>
						</MyErrorBoundary>
					))}

				<EntityDropPlaceholderZone
					dragId={dragId}
					ownerId={ownerId}
					entityCount={entities ? entities.length : 0}
					entityTypeLabel={entityTypeLabel}
				/>
			</div>
		</>
	)
})
