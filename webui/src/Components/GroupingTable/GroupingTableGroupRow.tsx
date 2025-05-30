import React, { useCallback, useState } from 'react'
import { CButton } from '@coreui/react'
import { faCaretRight, faCaretDown, faCheckCircle, faTrash, faPencilAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { TextInputField } from '../TextInputField.js'
import type { GroupingTableGroup, GroupApi } from './Types.js'
import { GroupingTableGroupRowWrapper } from './GroupingTableRowWrappers.js'

export interface GroupingTableGroupRowProps {
	group: GroupingTableGroup
	parentId: string | null
	isCollapsed: boolean
	toggleExpanded: () => void
	groupApi: GroupApi
	index: number
	nestingLevel: number
}

export const GroupingTableGroupRow = observer(function GroupingTableGroupRow({
	group,
	parentId,
	isCollapsed,
	toggleExpanded,
	groupApi,
	index,
	nestingLevel,
	children,
}: React.PropsWithChildren<GroupingTableGroupRowProps>) {
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

	return (
		<GroupingTableGroupRowWrapper group={group} parentId={parentId} index={index} nestingLevel={nestingLevel}>
			<div className="d-flex align-items-center justify-content-between" onClick={toggleExpanded2}>
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
		</GroupingTableGroupRowWrapper>
	)
})
