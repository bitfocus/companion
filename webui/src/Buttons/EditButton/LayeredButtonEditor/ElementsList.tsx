import { observer } from 'mobx-react-lite'
import React, { useContext, useRef } from 'react'
import { AddElementDropdownButton, RemoveElementButton, ToggleVisibilityButton } from './Buttons.js'
import { LayeredStyleStore } from './StyleStore.js'
import { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSort } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { useDrop, useDrag } from 'react-dnd'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../../../Components/GenericConfirmModal.js'

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
			<table className="button-layer-elementlist-table">
				<thead>
					<th className="compact">&nbsp;</th>
					<th>Name</th>
					<th className="compact element-buttons">
						<AddElementDropdownButton styleStore={styleStore} controlId={controlId} />
					</th>
				</thead>

				<tbody>
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
				</tbody>
			</table>
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
	const { socket } = useContext(RootAppStoreContext)

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
			socket
				.emitPromise('controls:style:move-element', [controlId, item.elementId, hoverParentElementId, hoverIndex])
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
			<tr key={element.id} ref={ref} className={classNames(commonClasses, 'last-row')}>
				<td></td>

				<td className="element-name" onClick={() => styleStore.setSelectedElementId(element.id)}>
					{element.name || 'Background'}
				</td>

				<td></td>
			</tr>
		)
	}

	return (
		<>
			<tr key={element.id} ref={ref} className={classNames(commonClasses, '')}>
				<td ref={drag} className="td-reorder">
					<FontAwesomeIcon icon={faSort} />
				</td>

				<td className="element-name" onClick={() => styleStore.setSelectedElementId(element.id)}>
					{element.name ?? element.type} - {depth}
				</td>

				<td className="element-buttons">
					<ToggleVisibilityButton styleStore={styleStore} controlId={controlId} elementId={element.id} />
					<RemoveElementButton controlId={controlId} elementId={element.id} confirmModalRef={confirmModalRef} />
				</td>
			</tr>
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
			{element.type === 'group' && element.children.length === 0 && (
				<ElementListItemPlaceholder parentElementId={element.id} controlId={controlId} />
			)}
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
	const { socket } = useContext(RootAppStoreContext)

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
			socket
				.emitPromise('controls:style:move-element', [controlId, item.elementId, hoverParentElementId, 0])
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
		<tr key={`${parentElementId}-placeholder`} ref={ref}>
			<td></td>

			<td className="element-name">Empty group</td>

			<td></td>
		</tr>
	)
})
