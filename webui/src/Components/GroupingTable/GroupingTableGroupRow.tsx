import React, { useCallback, useRef, useState } from 'react'
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
import { ConnectDropTarget, useDrag } from 'react-dnd'
import classNames from 'classnames'
import type { GroupingTableGroup, GroupApi, GroupingTableItem } from './Types.js'
import { GroupingTableGroupDragItem, useGroupListGroupDragging } from './useGroupDragging.js'
import { useGroupingTableContext } from './GroupingTableContext.js'

export interface GroupingTableGroupRowProps {
	group: GroupingTableGroup
	isCollapsed: boolean
	toggleExpanded: () => void
	groupApi: GroupApi
	index: number
	colSpan?: number
	dropInto?: ConnectDropTarget
	className?: string
	nestingLevel: number
}

export const GroupingTableGroupRow = observer(function GroupingTableGroupRow({
	group,
	isCollapsed,
	toggleExpanded,
	groupApi,
	index,
	colSpan = 4,
	dropInto,
	className,
	nestingLevel,
	children,
}: React.PropsWithChildren<GroupingTableGroupRowProps>) {
	const { dragId } = useGroupingTableContext<GroupingTableItem>()

	const [isEditing, setIsEditing] = useState(false)

	const toggleExpanded2 = useCallback(() => {
		if (isEditing) return
		toggleExpanded()
	}, [toggleExpanded, isEditing])

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
	const { isOver, drop } = useGroupListGroupDragging(groupApi, dragId, group.id)

	// Set up drag handling if reordering is enabled
	const [{ isDragging }, drag, preview] = useDrag<GroupingTableGroupDragItem, unknown, { isDragging: boolean }>({
		type: `${dragId}-group`,
		item: {
			groupId: group.id,
			index,
			dragState: null,
			// parentId: group.id || null,
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
			className={classNames(
				'collapsible-group-header',
				{
					dragging: isDragging,
				},
				className
			)}
			style={{
				// @ts-expect-error variables are not typed
				'--group-nesting-level': nestingLevel,
			}}
			onClick={toggleExpanded2}
		>
			<td colSpan={colSpan + 1}>
				<div
					className={classNames('d-flex align-items-center justify-content-between', {
						'collapsible-group-nesting': nestingLevel > 0,
					})}
				>
					<div ref={drag} className="collapsible-group-header-drag">
						<FontAwesomeIcon icon={faSort} />
					</div>
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
