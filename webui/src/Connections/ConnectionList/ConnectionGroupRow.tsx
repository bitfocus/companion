import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { CButton } from '@coreui/react'
import { faCaretRight, faCaretDown, faCheckCircle, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useState } from 'react'
import { PanelCollapseHelper } from '../../Helpers/CollapseHelper.js'

interface ConnectionGroupRowProps {
	group: ConnectionGroup
	toggleExpanded: (groupId: string) => void
	renameGroup: (groupId: string, newName: string) => void
	deleteGroup: (groupId: string) => void
	collapseHelper: PanelCollapseHelper
}
export const ConnectionGroupRow = observer(function ConnectionGroupRow({
	group,
	toggleExpanded,
	renameGroup,
	deleteGroup,
	collapseHelper,
}: ConnectionGroupRowProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [newName, setNewName] = useState(group.label)

	const handleRename = () => {
		renameGroup(group.id, newName)
		setIsEditing(false)
	}

	return (
		<tr className="connection-group-header">
			<td colSpan={5}>
				<div className="d-flex align-items-center">
					<CButton color="link" onClick={() => toggleExpanded(group.id)}>
						<FontAwesomeIcon icon={collapseHelper.isPanelCollapsed(null, group.id) ? faCaretRight : faCaretDown} />
					</CButton>
					{isEditing ? (
						<div className="d-flex align-items-center">
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onBlur={handleRename}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										handleRename()
									}
								}}
								autoFocus
							/>
							<CButton color="link" onClick={handleRename}>
								<FontAwesomeIcon icon={faCheckCircle} />
							</CButton>
						</div>
					) : (
						<span className="group-name" onClick={() => setIsEditing(true)}>
							{group.label}
						</span>
					)}
					<CButton color="link" onClick={() => deleteGroup(group.id)}>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</div>
			</td>
		</tr>
	)
})
