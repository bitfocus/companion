import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
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
import React, { useCallback, useRef, useState } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { TextInputField } from '../../Components/TextInputField.js'
import { checkDragState } from '../../util.js'
import { ConnectionGroupDragItem, ConnectionGroupDragStatus } from './ConnectionList.js'
import { useConnectionListDragging } from './ConnectionListDropZone.js'
import { ConnectionListApi } from './ConnectionListApi.js'

interface ConnectionGroupRowProps {
	group: ConnectionGroup
	toggleExpanded: (groupId: string) => void
	connectionListApi: ConnectionListApi
	isCollapsed: boolean
	index: number
}
export const ConnectionGroupRow = observer(function ConnectionGroupRow({
	group,
	toggleExpanded,
	connectionListApi,
	isCollapsed,
	index,
}: ConnectionGroupRowProps) {
	const [isEditing, setIsEditing] = useState(false)

	const toggleExpanded2 = useCallback(() => {
		if (isEditing) return

		toggleExpanded(group.id)
	}, [toggleExpanded, group.id, isEditing])

	const handleSetName = useCallback(
		(name: string) => connectionListApi.renameGroup(group.id, name),
		[connectionListApi.renameGroup, group.id]
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

	const clickDeleteGroup = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			connectionListApi.deleteGroup(group.id)
		},
		[connectionListApi.deleteGroup, group.id]
	)

	const { drop: dropInto } = useConnectionListDragging(group.id, -1)

	// For group drag-and-drop
	const ref = useRef(null)
	const [, drop] = useDrop<ConnectionGroupDragItem>({
		accept: 'connection-group',
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
			connectionListApi.reorderGroup(item.groupId, index)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = index
		},
	})

	const [{ isDragging }, drag, preview] = useDrag<ConnectionGroupDragItem, unknown, ConnectionGroupDragStatus>({
		type: 'connection-group',
		item: {
			groupId: group.id,
			index,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

	// Apply both drop handlers and drag
	preview(drop(dropInto(ref)))

	return (
		<tr
			ref={ref}
			className={`connection-group-header ${isDragging ? 'connectionlist-dragging' : ''}`}
			onClick={toggleExpanded2}
		>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td colSpan={5}>
				<div className="d-flex align-items-center justify-content-between">
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
								<FontAwesomeIcon icon={isCollapsed ? faCaretRight : faCaretDown} style={{ marginRight: '0.5em' }} />
								<span className="group-name">{group.label}</span>
							</>
						)}
					</div>
					<div className="d-flex align-items-center">
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
