import React, { useCallback, useRef, useState, CSSProperties } from 'react'
import { CButton } from '@coreui/react'
import {
	faCaretRight,
	faCaretDown,
	faCheckCircle,
	faTrash,
	faPencilAlt,
	faSort,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { TextInputField } from '../TextInputField.js'
import { ConnectDropTarget, useDrag, useDrop } from 'react-dnd'
import { checkDragState } from '../../util.js'

export interface CollapsibleGroup {
	id: string
	label?: string
	sortOrder?: number
	[key: string]: any
}

export interface DragItem {
	groupId: string
	index: number
	dragState: any
	parentId?: string | null
}

/**
 * Generic group API interface for reusable collapsible group operations
 */
export interface GroupApi {
	addNewGroup: (groupName?: string) => void
	renameGroup: (groupId: string, newName: string) => void
	deleteGroup: (groupId: string) => void
	moveGroup: (groupId: string, parentId: string | null, dropIndex: number) => void
}

export interface CollapsibleGroupRowProps {
	group: CollapsibleGroup
	isCollapsed: boolean
	toggleExpanded: (groupId: string) => void
	groupApi: GroupApi
	index: number
	acceptDragType: string
	colSpan?: number
	dropInto?: ConnectDropTarget
	indentStyle?: CSSProperties
	className?: string
}

export const CollapsibleGroupRow = observer(function CollapsibleGroupRow({
	group,
	isCollapsed,
	toggleExpanded,
	groupApi,
	index,
	acceptDragType,
	colSpan = 4,
	dropInto,
	indentStyle,
	className,
	children,
}: React.PropsWithChildren<CollapsibleGroupRowProps>) {
	const [isEditing, setIsEditing] = useState(false)

	const toggleExpanded2 = useCallback(() => {
		if (isEditing) return
		toggleExpanded(group.id)
	}, [toggleExpanded, group.id, isEditing])

	const handleSetName = useCallback((name: string) => groupApi.renameGroup(group.id, name), [groupApi, group.id])

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

	const clickDeleteGroup = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			groupApi.deleteGroup(group.id)
		},
		[groupApi, group.id]
	)

	// For group drag-and-drop
	const ref = useRef(null)
	const [{ isOver }, drop] = useDrop<DragItem, unknown, { isOver: boolean }>({
		accept: acceptDragType,
		collect: (monitor) => ({
			isOver: monitor.isOver({ shallow: true }),
		}),
		hover(item, monitor) {
			if (!ref.current) {
				return
			}

			if (!checkDragState(item, monitor, group.id)) return

			// Don't replace items with themselves
			if (item.groupId === group.id) {
				return
			}

			// Time to actually perform the action
			groupApi.moveGroup(item.groupId, group.parentId || null, index)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = index
		},
		drop(item, monitor) {
			// If the drop happened on the group row itself (not on a child row)
			// and we have a setGroupParent function, make this group the parent
			if (monitor.isOver({ shallow: true }) && groupApi.setGroupParent && item.groupId !== group.id) {
				// Avoid circular references by not allowing a parent to be dropped into its child
				if (item.groupId !== group.id) {
					groupApi.setGroupParent(item.groupId, group.id)
					return { parentChanged: true }
				}
				return {} // Return an empty object for all other cases
			}
			return {} // Return an empty object for all other cases
		},
	})

	// Set up drag handling if reordering is enabled
	const [{ isDragging }, drag, preview] = useDrag<DragItem, unknown, { isDragging: boolean }>({
		type: acceptDragType,
		item: {
			groupId: group.id,
			index,
			dragState: null,
			parentId: group.parentId || null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

	// Apply both drop handlers and drag
	preview(drop(dropInto ? dropInto(ref) : ref))

	return (
		<tr
			ref={ref}
			className={`collapsible-group-header ${isDragging ? 'dragging' : ''} ${isOver ? 'drop-target' : ''} ${className || ''}`}
			onClick={toggleExpanded2}
		>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td colSpan={colSpan}>
				<div className="d-flex align-items-center justify-content-between" style={indentStyle}>
					<div className="d-flex align-items-center flex-grow-1">
						{isEditing ? (
							<TextInputField
								value={group.label ?? ''}
								placeholder={`Give this group a name`}
								setValue={handleSetName}
								onBlur={handleNameFieldBlur}
								autoFocus
							/>
						) : (
							<>
								<FontAwesomeIcon
									icon={isCollapsed ? faCaretRight : faCaretDown}
									style={{ marginRight: '0.5em' }}
									className="caret-icon"
								/>
								<span className="group-name">{group.label}</span>
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

						<CButton color="link" onClick={clickDeleteGroup}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
					</div>
				</div>
			</td>
		</tr>
	)
})
