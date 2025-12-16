import { observer } from 'mobx-react-lite'
import React, { useRef } from 'react'
import { AddElementDropdownButton, RemoveElementButton, ToggleVisibilityButton } from './Buttons.js'
import type { LayeredStyleStore } from './StyleStore.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSort } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { useDrop, useDrag } from 'react-dnd'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

export const ElementsList = observer(function ElementsList({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}) {
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	return (
		<>
			<GenericConfirmModal ref={confirmModalRef} />
			<div className="button-layer-elementlist-table">
				<div className="button-layer-elementlist-table-row heading">
					<div className="td-reorder-placeholder">&nbsp;</div>
					<div>Name</div>
					<div></div>
					<div className="element-buttons">
						<AddElementDropdownButton styleStore={styleStore} controlId={controlId} />
					</div>
				</div>
				{styleStore.elements
					.map((element, i) => (
						<ElementListItem
							key={element.id}
							element={element}
							parentElementId={null}
							index={i}
							depth={0}
							styleStore={styleStore}
							confirmModalRef={confirmModalRef}
							controlId={controlId}
						/>
					))
					.toReversed()}
			</div>
		</>
	)
})

const DRAG_ID = 'button-element-item'

interface ElementListDragItem {
	elementId: string
	index: number
	parentElementId: string | null
}

interface ElementListRowDragStatus {
	isDragging: boolean
}

const ElementListItem = observer(function ElementListItem({
	element,
	index,
	depth,
	parentElementId,
	styleStore,
	controlId,
	confirmModalRef,
}: {
	element: SomeButtonGraphicsElement
	index: number
	depth: number
	parentElementId: string | null
	styleStore: LayeredStyleStore
	controlId: string
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
}) {
	const moveElement = useMutationExt(trpc.controls.styles.moveElement.mutationOptions())

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<ElementListDragItem>({
		accept: DRAG_ID,
		drop(item, monitor) {
			if (!ref.current) {
				return
			}

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			const hoverIndex = index
			const hoverParentElementId = parentElementId
			const hoverId = element.id

			// Don't replace items with themselves
			if (item.parentElementId === parentElementId && (item.elementId === hoverId || item.index === hoverIndex)) {
				return
			}

			// Time to actually perform the change
			moveElement
				.mutateAsync({
					controlId,
					elementId: item.elementId,
					parentElementId: hoverParentElementId,
					newIndex: hoverIndex,
				})
				.catch((e) => {
					console.error('Failed to move element', e)
				})

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
			item.parentElementId = hoverParentElementId
		},
	})
	const [{ isDragging }, drag, preview] = useDrag<ElementListDragItem, unknown, ElementListRowDragStatus>({
		type: DRAG_ID,
		canDrag: element.type !== 'canvas',
		item: {
			elementId: element.id,
			index: index,
			parentElementId: parentElementId,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	let commonClasses = styleStore.selectedElementId === element.id ? 'selected-row' : ''
	if (isDragging) commonClasses += ' dragging'

	if (element.type === 'canvas') {
		return (
			<div
				key={element.id}
				ref={ref}
				className={classNames(commonClasses, 'button-layer-elementlist-table-row last-row')}
			>
				<div className="td-reorder-placeholder"></div>

				<div className="element-name" onClick={() => styleStore.setSelectedElementId(element.id)}>
					{element.name || 'Background'}
				</div>

				<div></div>
			</div>
		)
	}

	return (
		<>
			<div
				key={element.id}
				ref={ref}
				className={classNames(commonClasses, 'button-layer-elementlist-table-row')}
				style={{
					// @ts-expect-error custom variable
					'--elementlist-depth': depth,
				}}
			>
				<div ref={drag} className="td-reorder">
					<FontAwesomeIcon icon={faSort} />
				</div>

				<div className="element-name" onClick={() => styleStore.setSelectedElementId(element.id)}>
					{element.name ?? element.type}
				</div>

				<div className="element-buttons">
					<ToggleVisibilityButton styleStore={styleStore} elementId={element.id} />
					<RemoveElementButton controlId={controlId} elementId={element.id} confirmModalRef={confirmModalRef} />
				</div>
			</div>

			{element.type === 'group' && element.children.length === 0 && (
				<ElementListItemPlaceholder parentElementId={element.id} controlId={controlId} />
			)}
			{element.type === 'group' &&
				element.children
					.map((child, i) => (
						<ElementListItem
							key={child.id}
							element={child}
							parentElementId={element.id}
							index={i}
							depth={depth + 1}
							styleStore={styleStore}
							confirmModalRef={confirmModalRef}
							controlId={controlId}
						/>
					))
					.toReversed()}
		</>
	)
})

const ElementListItemPlaceholder = observer(function ElementListItemPlaceholder({
	parentElementId,
	controlId,
}: {
	parentElementId: string | null
	controlId: string
}) {
	const moveElement = useMutationExt(trpc.controls.styles.moveElement.mutationOptions())

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<ElementListDragItem>({
		accept: DRAG_ID,
		drop(item, monitor) {
			if (!ref.current) {
				return
			}

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			const hoverParentElementId = parentElementId

			// // Don't replace items with themselves
			// if (item.parentElementId === parentElementId && (item.elementId === parentElementId || item.index === hoverIndex)) {
			// 	return
			// }

			// Time to actually perform the change
			moveElement
				.mutateAsync({
					controlId,
					elementId: item.elementId,
					parentElementId: hoverParentElementId,
					newIndex: 0, // Always move to the start of the group
				})
				.catch((e) => {
					console.error('Failed to move element', e)
				})

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = 0
			item.parentElementId = hoverParentElementId
		},
	})

	drop(ref)

	return (
		<div key={`${parentElementId}-placeholder`} ref={ref} className="button-layer-elementlist-table-row">
			<div className="td-reorder-placeholder"></div>

			<div className="element-name">Empty group</div>

			<div></div>
		</div>
	)
})
