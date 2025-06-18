import React, { useCallback } from 'react'
import { CButtonGroup, CButton, CFormSwitch } from '@coreui/react'
import { faPencil, faExpandArrowsAlt, faCompressArrowsAlt, faCopy, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService.js'
import { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { observer } from 'mobx-react-lite'

interface EntityCellControlProps {
	service: IEntityEditorActionService
	entityTypeLabel: string
	entity: SomeEntityModel
	isPanelCollapsed: boolean
	setPanelCollapsed: (collapsed: boolean) => void
	definitionName: string
	canSetHeadline: boolean
	headlineExpanded: boolean
	setHeadlineExpanded: () => void
	readonly: boolean
}

export const EntityRowHeader = observer(function EntityRowHeader({
	service,
	entityTypeLabel,
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
		[service]
	)

	const doCollapse = useCallback(() => setPanelCollapsed(true), [setPanelCollapsed])
	const doExpand = useCallback(() => setPanelCollapsed(false), [setPanelCollapsed])

	return (
		<div className="editor-grid-header">
			<div className="cell-name">
				{!service.setHeadline || !headlineExpanded || isPanelCollapsed ? (
					entity.headline || definitionName
				) : (
					<TextInputField
						value={entity.headline ?? ''}
						placeholder={`Describe the intent of the ${entityTypeLabel}`}
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
						<CButton size="sm" onClick={doExpand} title={`Expand ${entityTypeLabel} view`}>
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>
					) : (
						<CButton size="sm" onClick={doCollapse} title={`Collapse ${entityTypeLabel} view`}>
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					)}
					<CButton
						size="sm"
						disabled={readonly}
						onClick={service.performDuplicate}
						title={`Duplicate ${entityTypeLabel}`}
					>
						<FontAwesomeIcon icon={faCopy} />
					</CButton>
					<CButton size="sm" disabled={readonly} onClick={service.performDelete} title={`Remove ${entityTypeLabel}`}>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
					{!!service.setEnabled && (
						<>
							&nbsp;
							<CFormSwitch
								color="success"
								checked={!entity.disabled}
								title={entity.disabled ? `Enable ${entityTypeLabel}` : `Disable ${entityTypeLabel}`}
								onChange={innerSetEnabled}
							/>
						</>
					)}
				</CButtonGroup>
			</div>
		</div>
	)
})
