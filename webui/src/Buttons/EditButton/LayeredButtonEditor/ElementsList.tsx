import { useDragDropMonitor, useDroppable } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { faCog, faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useRef } from 'react'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { capitalize } from '@companion-app/shared/Util.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
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
// dnd-kit sortable `group` value for the top-level (non-nested) elements. Child groups use their
// group element's id as the group value.
const ROOT_GROUP = '__elements_root__'

// The list is displayed reversed (top layer first) but the backend stores/indexes in data order,
// so a sortable position has to be converted back. `groupSize` is the number of elements in the
// target group's *data* array (including the locked canvas at top-level).
function visualIndexToDataIndex(visualIndex: number, groupSize: number): number {
	return groupSize - 1 - visualIndex
}

const EMPTY_GROUP_DROPPABLE_PREFIX = 'element-empty-group:'
function emptyGroupDroppableId(groupId: string): string {
	return EMPTY_GROUP_DROPPABLE_PREFIX + groupId
}
function parseEmptyGroupDroppableId(id: unknown): string | null {
	return typeof id === 'string' && id.startsWith(EMPTY_GROUP_DROPPABLE_PREFIX)
		? id.slice(EMPTY_GROUP_DROPPABLE_PREFIX.length)
		: null
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

	useDragDropMonitor({
		onDragEnd(event) {
			if (event.canceled) return
			const { source, target } = event.operation
			if (!source || source.type !== DRAG_ID) return
			const elementId = String(source.id)

			// Dropped onto an empty group's placeholder - move to the start of that group
			const emptyGroupId = parseEmptyGroupDroppableId(target?.id)
			if (emptyGroupId !== null) {
				if (emptyGroupId !== elementId) doMove(elementId, emptyGroupId, 0)
				return
			}

			// Reorder / move between non-empty groups, described by the sortable's projected position
			if (!isSortable(source)) return
			const { initialIndex, index, initialGroup, group } = source
			if (group == null) return
			if (initialGroup === group && initialIndex === index) return

			const parentElementId = group === ROOT_GROUP ? null : String(group)
			const crossGroup = initialGroup !== group
			const groupSize = countGroupSize(String(group)) + (crossGroup ? 1 : 0)
			doMove(elementId, parentElementId, visualIndexToDataIndex(index, groupSize))
		},
	})

	// Non-canvas elements are sortable; the canvas (background) is pinned at the bottom (data index 0,
	// which the backend locks) and rendered as a static row.
	const reversed = [...styleStore.elements].reverse()
	const sortableElements = reversed.filter((element) => element.type !== 'canvas')
	const canvasElements = reversed.filter((element) => element.type === 'canvas')

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
	const { ref, handleRef } = useSortable({ id: element.id, index, type: DRAG_ID, group, transition: null })

	const commonClasses = styleStore.selectedElementId === element.id ? 'selected-row' : ''
	const elementType = capitalize(element.type)

	return (
		<>
			<div
				ref={ref}
				className={classNames(commonClasses, 'button-layer-elementlist-table-row')}
				style={{
					// @ts-expect-error custom variable
					'--elementlist-depth': depth,
				}}
			>
				<div ref={handleRef} className="td-reorder">
					<FontAwesomeIcon icon={faSort} />
				</div>

				<div className="element-name" title={element.name} onClick={() => styleStore.setSelectedElementId(element.id)}>
					<span title={elementType}>
						<FontAwesomeIcon icon={getElementTypeIcon(element.type)} className="me-1" fixedWidth />
					</span>
					{element.name || elementType}
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
	const commonClasses = styleStore.selectedElementId === element.id ? 'selected-row' : ''

	return (
		<div className={classNames(commonClasses, 'button-layer-elementlist-table-row last-row')}>
			<div className="td-reorder-placeholder"></div>

			<div className="element-name" title={element.name} onClick={() => styleStore.setSelectedElementId(element.id)}>
				<span title="Canvas Settings">
					<FontAwesomeIcon icon={faCog} className="me-1" fixedWidth />
				</span>
				{element.name || 'Canvas'}
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
	const { ref } = useDroppable({ id: emptyGroupDroppableId(groupId), accept: DRAG_ID })

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
