import React, { useCallback } from 'react'
import { CButtonGroup, CButton, CFormSwitch } from '@coreui/react'
import { faPencil, faExpandArrowsAlt, faCompressArrowsAlt, faCopy, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IEntityEditorActionService } from '../../Services/Controls/ControlEntitiesService.js'
import { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { TextInputField } from '../../Components/TextInputField.js'

interface EntityCellControlProps {
	service: IEntityEditorActionService
	entityType: string
	entity: SomeEntityModel
	isPanelCollapsed: boolean
	setPanelCollapsed: (collapsed: boolean) => void
	definitionName: string
	canSetHeadline: boolean
	headlineExpanded: boolean
	setHeadlineExpanded: () => void
	readonly: boolean
}

export function EntityRowHeader({
	service,
	entityType,
	entity,
	isPanelCollapsed,
	setPanelCollapsed,
	definitionName,
	canSetHeadline,
	headlineExpanded,
	setHeadlineExpanded,
	readonly,
}: EntityCellControlProps) {
	const innerSetEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => service.setEnabled?.(e.target.checked),
		[service.setEnabled]
	)

	const doCollapse = useCallback(() => setPanelCollapsed(true), [setPanelCollapsed])
	const doExpand = useCallback(() => setPanelCollapsed(false), [setPanelCollapsed])

	return (
		<div className="editor-grid-header remove075right">
			<div className="cell-name">
				{!service.setHeadline || !headlineExpanded || isPanelCollapsed ? (
					entity.headline || definitionName
				) : (
					<TextInputField
						value={entity.headline ?? ''}
						placeholder={`Describe the intent of the ${entityType}`}
						setValue={service.setHeadline}
					/>
				)}
			</div>
			<div className="cell-controls">
				<CButtonGroup>
					{canSetHeadline && !headlineExpanded && !isPanelCollapsed && (
						<CButton size="sm" onClick={setHeadlineExpanded} title="Set headline">
							<FontAwesomeIcon icon={faPencil} />
						</CButton>
					)}
					{isPanelCollapsed ? (
						<CButton size="sm" onClick={doExpand} title={`Expand ${entityType} view`}>
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>
					) : (
						<CButton size="sm" onClick={doCollapse} title={`Collapse ${entityType} view`}>
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					)}
					<CButton size="sm" disabled={readonly} onClick={service.performDuplicate} title={`Duplicate ${entityType}`}>
						<FontAwesomeIcon icon={faCopy} />
					</CButton>
					<CButton size="sm" disabled={readonly} onClick={service.performDelete} title={`Remove ${entityType}`}>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
					{!!service.setEnabled && (
						<>
							&nbsp;
							<CFormSwitch
								color="success"
								checked={!entity.disabled}
								title={entity.disabled ? `Enable ${entityType}` : `Disable ${entityType}`}
								onChange={innerSetEnabled}
							/>
						</>
					)}
				</CButtonGroup>
			</div>
		</div>
	)
}
