import { pointerIntersection } from '@dnd-kit/collision'
import { useDragDropMonitor, useDroppable } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { faCog, faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useRef } from 'react'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { DragCloneOverlay } from '~/Resources/DragCloneOverlay.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import {
	AddElementDropdownButton,
	DuplicateElementButton,
	getElementTypeIcon,
	RemoveElementButton,
	ToggleVisibilityButton,
} from './Buttons.js'
import type { LayeredStyleStore } from './StyleStore.js'

const DRAG_ID = 'button-element-item'
const ROOT_GROUP = '__elements_root__'

function visualIndexToDataIndex(visualIndex: number, groupSize: number): number {
	// The list is rendered reversed (top layer first) but stored in data order. `groupSize` includes the
	// locked canvas at top-level.
	return groupSize - 1 - visualIndex
}

// Drop target for the bottom of the root list (above the locked canvas) - the only way to drop after a
// group that is the last root element, since a group's header renders above its children.
const ROOT_BOTTOM_DROPPABLE = 'element-root-bottom'

const EMPTY_GROUP_DROPPABLE_PREFIX = 'element-empty-group:'
function emptyGroupDroppableId(groupId: string): string {
	return EMPTY_GROUP_DROPPABLE_PREFIX + groupId
}
function parseEmptyGroupDroppableId(id: unknown): string | null {
	return typeof id === 'string' && id.startsWith(EMPTY_GROUP_DROPPABLE_PREFIX)
		? id.slice(EMPTY_GROUP_DROPPABLE_PREFIX.length)
		: null
}

// The `group` value the element currently lives in (ROOT_GROUP or its parent group's id), or null.
function findElementGroupValue(
	elements: readonly SomeButtonGraphicsElement[],
	id: string,
	group: string = ROOT_GROUP
): string | null {
	for (const element of elements) {
		if (element.id === id) return group
		if (element.type === 'group') {
			const found = findElementGroupValue(element.children, id, element.id)
			if (found !== null) return found
		}
	}
	return null
}

function findElementInTree(
	elements: readonly SomeButtonGraphicsElement[],
	id: string
): SomeButtonGraphicsElement | undefined {
	for (const element of elements) {
		if (element.id === id) return element
		if (element.type === 'group') {
			const found = findElementInTree(element.children, id)
			if (found) return found
		}
	}
	return undefined
}

// True if `candidateId` is `ancestorId` itself or nested inside it - rejects moving a group into itself.
function isSelfOrDescendant(
	elements: readonly SomeButtonGraphicsElement[],
	ancestorId: string,
	candidateId: string
): boolean {
	if (ancestorId === candidateId) return true
	const ancestor = findElementInTree(elements, ancestorId)
	if (!ancestor || ancestor.type !== 'group') return false
	return !!findElementInTree(ancestor.children, candidateId)
}

export const ElementsList = observer(function ElementsList({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}) {
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const moveElement = useMutationExt(trpc.controls.styles.moveElement.mutationOptions())

	// Number of elements in a group's data array (top-level includes the locked canvas)
	const countGroupSize = useCallback(
		(group: string): number => {
			if (group === ROOT_GROUP) return styleStore.elements.length
			const element = styleStore.findElementById(group)
			return element && element.type === 'group' ? element.children.length : 0
		},
		[styleStore]
	)

	const doMove = useCallback(
		(elementId: string, parentElementId: string | null, newIndex: number) => {
			moveElement.mutateAsync({ controlId, elementId, parentElementId, newIndex }).catch((e) => {
				console.error('Failed to move element', e)
			})
		},
		[moveElement, controlId]
	)

	// Dedupe the resolved destination so hover-move doesn't re-fire on every dragover over the same slot.
	const lastDestRef = useRef<string | null>(null)

	useDragDropMonitor({
		// Move live on hover, driven by the target under the cursor, so dnd-kit's sortable state stays in
		// sync with the data (resolving a projected position only on drop leaves them disagreeing).
		onDragOver(event) {
			const { source, target } = event.operation
			if (!source || source.type !== DRAG_ID) return
			const elementId = String(source.id)

			let parentElementId: string | null
			let newIndex: number
			let destKey: string

			const emptyGroupId = parseEmptyGroupDroppableId(target?.id)
			if (target?.id === ROOT_BOTTOM_DROPPABLE) {
				// Canvas row - drop at data index 1, just above the locked canvas (skip if already there)
				if (styleStore.elements[1]?.id === elementId) return
				parentElementId = null
				newIndex = 1
				destKey = 'root-bottom'
			} else if (emptyGroupId !== null) {
				// Empty group placeholder - drop as its only child
				if (isSelfOrDescendant(styleStore.elements, elementId, emptyGroupId)) return
				parentElementId = emptyGroupId
				newIndex = 0
				destKey = `empty:${emptyGroupId}`
			} else if (target && isSortable(target) && target.type === DRAG_ID) {
				if (String(target.id) === elementId) return // hovering its own row
				const group = target.group
				if (group == null) return
				const destParent = group === ROOT_GROUP ? null : String(group)
				if (destParent !== null && isSelfOrDescendant(styleStore.elements, elementId, destParent)) return

				const crossGroup = findElementGroupValue(styleStore.elements, elementId) !== String(group)
				const groupSize = countGroupSize(String(group)) + (crossGroup ? 1 : 0)
				parentElementId = destParent
				newIndex = visualIndexToDataIndex(target.index, groupSize)
				destKey = `${String(group)}:${target.index}`
			} else {
				return
			}

			if (lastDestRef.current === destKey) return
			lastDestRef.current = destKey
			doMove(elementId, parentElementId, newIndex)
		},

		onDragEnd() {
			lastDestRef.current = null // moves already applied on hover
		},
	})

	// The canvas is locked at the bottom (data index 0) and rendered as a static row; the rest sort.
	const reversed = [...styleStore.elements].reverse()
	const sortableElements = reversed.filter((element) => element.type !== 'canvas')
	const canvasElements = reversed.filter((element) => element.type === 'canvas')

	return (
		<>
			<GenericConfirmModal ref={confirmModalRef} />
			<div className="button-layer-elementlist-table">
				{/* Inside the table so the drag preview clone is styled by the real CSS */}
				<DragCloneOverlay disabled={(source) => source?.type !== DRAG_ID} />

				<div className="button-layer-elementlist-table-row heading">
					<div className="td-reorder-placeholder">&nbsp;</div>
					<div>Name</div>
					<div></div>
					<div className="element-buttons">
						<AddElementDropdownButton styleStore={styleStore} controlId={controlId} />
					</div>
				</div>
				{sortableElements.map((element, index) => (
					<ElementListItem
						key={element.id}
						element={element}
						group={ROOT_GROUP}
						index={index}
						depth={0}
						styleStore={styleStore}
						confirmModalRef={confirmModalRef}
						controlId={controlId}
					/>
				))}
				{canvasElements.map((element) => (
					<CanvasElementRow key={element.id} element={element} styleStore={styleStore} />
				))}
			</div>
		</>
	)
})

const ElementListItem = observer(function ElementListItem({
	element,
	index,
	depth,
	group,
	styleStore,
	controlId,
	confirmModalRef,
}: {
	element: SomeButtonGraphicsElement
	index: number
	depth: number
	group: string
	styleStore: LayeredStyleStore
	controlId: string
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
}) {
	// Reorders on hover (see the monitor): target what's under the cursor, and dim the source row since
	// the preview is a DragOverlay clone rather than the moved source.
	const { ref, handleRef, isDragging } = useSortable({
		id: element.id,
		index,
		type: DRAG_ID,
		accept: DRAG_ID,
		group,
		data: { kind: 'layer-element' },
		transition: null,
		collisionDetector: pointerIntersection,
	})

	const commonClasses = styleStore.selectedElementId === element.id ? 'selected-row' : ''

	return (
		<>
			<div
				ref={ref}
				className={classNames(commonClasses, 'button-layer-elementlist-table-row', { 'row-dragging': isDragging })}
				style={{
					// @ts-expect-error custom variable
					'--elementlist-depth': depth,
				}}
			>
				<div ref={handleRef} className="td-reorder">
					<FontAwesomeIcon icon={faSort} />
				</div>

				<div className="element-name" title={element.name} onClick={() => styleStore.setSelectedElementId(element.id)}>
					<FontAwesomeIcon icon={getElementTypeIcon(element.type)} className="me-1" fixedWidth />
					{element.name || element.type}
				</div>

				<div className="element-buttons">
					<ToggleVisibilityButton styleStore={styleStore} elementId={element.id} />
					<DuplicateElementButton controlId={controlId} elementId={element.id} />
					<RemoveElementButton controlId={controlId} elementId={element.id} confirmModalRef={confirmModalRef} />
				</div>
			</div>

			{element.type === 'group' && element.children.length === 0 && (
				<ElementGroupPlaceholder groupId={element.id} depth={depth + 1} />
			)}
			{element.type === 'group' &&
				element.children
					.toReversed()
					.map((child, childIndex) => (
						<ElementListItem
							key={child.id}
							element={child}
							group={element.id}
							index={childIndex}
							depth={depth + 1}
							styleStore={styleStore}
							confirmModalRef={confirmModalRef}
							controlId={controlId}
						/>
					))}
		</>
	)
})

const CanvasElementRow = observer(function CanvasElementRow({
	element,
	styleStore,
}: {
	element: SomeButtonGraphicsElement
	styleStore: LayeredStyleStore
}) {
	// Drop target for placing an element at the bottom of the root list (see ROOT_BOTTOM_DROPPABLE).
	const { ref } = useDroppable({ id: ROOT_BOTTOM_DROPPABLE, accept: DRAG_ID, collisionDetector: pointerIntersection })

	const commonClasses = styleStore.selectedElementId === element.id ? 'selected-row' : ''

	return (
		<div ref={ref} className={classNames(commonClasses, 'button-layer-elementlist-table-row last-row')}>
			<div className="td-reorder-placeholder"></div>

			<div className="element-name" title={element.name} onClick={() => styleStore.setSelectedElementId(element.id)}>
				<FontAwesomeIcon icon={faCog} className="me-1" fixedWidth />
				{element.name || 'Background'}
			</div>

			<div></div>
		</div>
	)
})

const ElementGroupPlaceholder = observer(function ElementGroupPlaceholder({
	groupId,
	depth,
}: {
	groupId: string
	depth: number
}) {
	// Match the elements' pointer-based collision so a hovered element can target this placeholder.
	const { ref } = useDroppable({
		id: emptyGroupDroppableId(groupId),
		accept: DRAG_ID,
		collisionDetector: pointerIntersection,
	})

	return (
		<div
			ref={ref}
			className="button-layer-elementlist-table-row"
			style={{
				// @ts-expect-error custom variable
				'--elementlist-depth': depth,
			}}
		>
			<div className="td-reorder-placeholder"></div>

			<div className="element-name">Empty group</div>

			<div></div>
		</div>
	)
})
