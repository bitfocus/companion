import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { CButton } from '@coreui/react'
import { faCaretRight, faCaretDown, faCheckCircle, faTrash, faPencilAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useState } from 'react'
import { TextInputField } from '../../Components/TextInputField.js'
import { useConnectionListDragging } from './ConnectionListDropZone.js'
import { ConnectionListApi } from './ConnectionListApi.js'

interface ConnectionGroupRowProps {
	group: ConnectionGroup
	toggleExpanded: (groupId: string) => void
	connectionListApi: ConnectionListApi
	isCollapsed: boolean
}
export const ConnectionGroupRow = observer(function ConnectionGroupRow({
	group,
	toggleExpanded,
	connectionListApi,
	isCollapsed,
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

	const { drop } = useConnectionListDragging(group.id, -1)

	return (
		<tr ref={drop} className="connection-group-header" onClick={toggleExpanded2}>
			<td>
				<FontAwesomeIcon icon={isCollapsed ? faCaretRight : faCaretDown} />
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
							<span className="group-name">{group.label}</span>
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
