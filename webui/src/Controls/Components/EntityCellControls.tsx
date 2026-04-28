import { CButton, CButtonGroup } from '@coreui/react'
import { faClone, faCompressArrowsAlt, faExpandArrowsAlt, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { EntityModelType, type EntityOwner, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { TextInputField } from '~/Components/TextInputField.js'
import type { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService.js'

interface EntityCellControlProps {
	service: IEntityEditorActionService
	entityTypeLabel: string
	entity: SomeEntityModel
	ownerId: EntityOwner | null
	isPanelCollapsed: boolean
	setPanelCollapsed: (collapsed: boolean) => void
	definitionName: string
	canSetHeadline: boolean
	headlineExpanded: boolean
	setHeadlineExpanded: () => void
	readonly: boolean
	localVariablePrefix: string | null
}

export const EntityRowHeader = observer(function EntityRowHeader({
	service,
	entityTypeLabel,
	entity,
	ownerId,
	isPanelCollapsed,
	setPanelCollapsed,
	definitionName,
	canSetHeadline,
	headlineExpanded,
	setHeadlineExpanded,
	readonly,
	localVariablePrefix,
}: EntityCellControlProps) {
	const doCollapse = useCallback(() => setPanelCollapsed(true), [setPanelCollapsed])
	const doExpand = useCallback(() => setPanelCollapsed(false), [setPanelCollapsed])

	let headline = entity.headline || definitionName
	if (isPanelCollapsed && localVariablePrefix && entity.type === EntityModelType.Feedback && !ownerId) {
		if (entity.variableName) {
			headline = `$(local:${entity.variableName}) ${entity.headline || ''}`
		} else {
			headline = `Unnamed: ${entity.headline || ''}`
		}
	}

	return (
		<div className="editor-grid-header">
			<div className="cell-name">
				{!service.setHeadline || !headlineExpanded || isPanelCollapsed ? (
					headline
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
						<FontAwesomeIcon icon={faClone} />
					</CButton>
					<CButton size="sm" disabled={readonly} onClick={service.performDelete} title={`Remove ${entityTypeLabel}`}>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
					{!!service.setEnabled && (
						<>
							&nbsp;
							<SwitchInputField
								value={!entity.disabled}
								tooltip={entity.disabled ? `Enable ${entityTypeLabel}` : `Disable ${entityTypeLabel}`}
								setValue={service.setEnabled}
								small
							/>
						</>
					)}
				</CButtonGroup>
			</div>
		</div>
	)
})
