import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { CButton } from '@coreui/react'
import { faCaretRight, faCaretDown, faCheckCircle, faTrash, faPencilAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useState } from 'react'
import { PanelCollapseHelper } from '../../Helpers/CollapseHelper.js'
import { TextInputField } from '../../Components/TextInputField.js'

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

	const handleSetName = useCallback((name: string) => renameGroup(group.id, name), [renameGroup, group.id])
	const handleNameFieldBlur = useCallback(
		() =>
			// Delay to ensure if the check is clicked it doesn't fire twice
			setTimeout(() => {
				setIsEditing(false)
			}, 100),
		[]
	)

	return (
		<tr className="connection-group-header">
			<td colSpan={5}>
				<div className="d-flex align-items-center justify-content-between">
					<div className="d-flex align-items-center">
						<CButton color="link" onClick={() => toggleExpanded(group.id)}>
							<FontAwesomeIcon icon={collapseHelper.isPanelCollapsed(null, group.id) ? faCaretRight : faCaretDown} />
						</CButton>
						{isEditing ? (
							<TextInputField
								value={group.label ?? ''}
								placeholder={`Give this group a name`}
								setValue={handleSetName}
								onBlur={handleNameFieldBlur}
								autoFocus
							/>
						) : (
							<span className="group-name" onClick={() => toggleExpanded(group.id)}>
								{group.label}
							</span>
						)}
					</div>
					<div className="d-flex align-items-center">
						{isEditing ? (
							<CButton color="link" onClick={handleNameFieldBlur}>
								<FontAwesomeIcon icon={faCheckCircle} />
							</CButton>
						) : (
							<CButton color="link" onClick={() => setIsEditing(true)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</CButton>
						)}
						<CButton color="link" onClick={() => deleteGroup(group.id)}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
					</div>
				</div>
			</td>
		</tr>
	)
})
