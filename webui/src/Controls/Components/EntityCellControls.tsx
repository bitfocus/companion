import { faClone, faCompressArrowsAlt, faExpandArrowsAlt, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { EntityOwner, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { VariableValueDisplayPopover } from '~/Components/VariableValueDisplay.js'
import type { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService.js'
import type { LocalVariablesStore } from '../LocalVariablesStore.js'
import { getEntityRowHeaderDisplay } from './EntityRowHeaderDisplay.js'

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
	localVariablesStore: LocalVariablesStore | null
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
	localVariablesStore,
	localVariablePrefix,
}: EntityCellControlProps) {
	const doCollapse = useCallback(() => setPanelCollapsed(true), [setPanelCollapsed])
	const doExpand = useCallback(() => setPanelCollapsed(false), [setPanelCollapsed])

	// When a local variable is collapsed, show its name and current value instead of the definition name
	const { headline, localVariableValueName } = getEntityRowHeaderDisplay(
		entity,
		ownerId,
		definitionName,
		isPanelCollapsed,
		localVariablePrefix
	)

	return (
		<div className="editor-grid-header">
			<div className="cell-name">
				{!service.setHeadline || !headlineExpanded || isPanelCollapsed ? (
					localVariableValueName !== null && localVariablesStore ? (
						<div className="cell-name-local-variable">
							<span className="cell-name-local-variable-label">{headline}</span>
							<VariableValueDisplayPopover
								value={localVariablesStore.getValue(localVariableValueName)}
								showCopy={false}
							/>
						</div>
					) : (
						headline
					)
				) : (
					<TextInputFieldSimple
						id={undefined}
						value={entity.headline ?? ''}
						placeholder={`Describe the intent of the ${entityTypeLabel}`}
						setValue={service.setHeadline}
					/>
				)}
			</div>
			<div className="cell-controls">
				<ButtonGroup className="me-1">
					{canSetHeadline && !headlineExpanded && !isPanelCollapsed && (
						<Button size="sm" onClick={setHeadlineExpanded} title="Set headline">
							<FontAwesomeIcon icon={faPencil} />
						</Button>
					)}
					{isPanelCollapsed ? (
						<Button size="sm" onClick={doExpand} title={`Expand ${entityTypeLabel} view`}>
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</Button>
					) : (
						<Button size="sm" onClick={doCollapse} title={`Collapse ${entityTypeLabel} view`}>
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</Button>
					)}
					<Button
						size="sm"
						disabled={readonly}
						onClick={service.performDuplicate}
						title={`Duplicate ${entityTypeLabel}`}
					>
						<FontAwesomeIcon icon={faClone} />
					</Button>
					<Button size="sm" disabled={readonly} onClick={service.performDelete} title={`Remove ${entityTypeLabel}`}>
						<FontAwesomeIcon icon={faTrash} />
					</Button>
					{!!service.setEnabled && (
						<>
							&nbsp;
							<SwitchInputField
								id={undefined}
								value={!entity.disabled}
								tooltip={entity.disabled ? `Enable ${entityTypeLabel}` : `Disable ${entityTypeLabel}`}
								setValue={service.setEnabled}
								small
							/>
						</>
					)}
				</ButtonGroup>
			</div>
		</div>
	)
})
