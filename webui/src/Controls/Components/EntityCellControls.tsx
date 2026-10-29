import { observer } from 'mobx-react-lite'
import { useCallback, useState } from 'react'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType, type EntityOwner, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { EditorRow } from '~/Components/EditorRow.js'
import { VariableValueDisplayPopover } from '~/Components/VariableValueDisplay.js'
import type { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService.js'
import type { LocalVariablesStore } from '../LocalVariablesStore.js'
import { getEntityRowHeaderDisplay } from './EntityRowHeaderDisplay.js'

interface EntityCellControlProps {
	service: IEntityEditorActionService
	entityTypeLabel: string
	entity: SomeEntityModel
	entityDefinition: ClientEntityDefinition | undefined
	connectionLabel: string
	ownerId: EntityOwner | null
	isPanelCollapsed: boolean
	canCollapse: boolean
	setPanelCollapsed: (collapsed: boolean) => void
	definitionName: string
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
	localVariablePrefix: string | null
}

export const EntityRowHeader = observer(function EntityRowHeader({
	service,
	entityTypeLabel,
	entity,
	connectionLabel,
	ownerId,
	isPanelCollapsed,
	canCollapse,
	setPanelCollapsed,
	definitionName,
	readonly,
	localVariablesStore,
	localVariablePrefix,
}: EntityCellControlProps) {
	const canSetHeadline = !!service.setHeadline
	const [noteEditing, setNoteEditing] = useState(false)

	const toggleCollapse = useCallback(() => {
		if (!canCollapse) return
		if (!isPanelCollapsed) setNoteEditing(false)
		setPanelCollapsed(!isPanelCollapsed)
	}, [canCollapse, isPanelCollapsed, setPanelCollapsed])

	// When a local variable is collapsed, show its name and current value instead of the definition name
	const { headline, localVariableValueName } = getEntityRowHeaderDisplay(
		entity,
		ownerId,
		definitionName,
		isPanelCollapsed,
		localVariablePrefix
	)

	const isCollapsedLocalVariable =
		isPanelCollapsed && !!localVariablePrefix && entity.type === EntityModelType.Feedback && !ownerId

	let cleanDefinitionName = definitionName
	if (connectionLabel && cleanDefinitionName.toLowerCase().startsWith(`${connectionLabel.toLowerCase()}:`)) {
		cleanDefinitionName = cleanDefinitionName.slice(connectionLabel.length + 1).trim()
	}

	let cleanHeadline = isCollapsedLocalVariable ? headline : cleanDefinitionName
	if (
		isCollapsedLocalVariable &&
		connectionLabel &&
		cleanHeadline.toLowerCase().startsWith(`${connectionLabel.toLowerCase()}:`)
	) {
		cleanHeadline = cleanHeadline.slice(connectionLabel.length + 1).trim()
	}

	return (
		<EditorRow.Header
			onToggleCollapsed={canCollapse ? toggleCollapse : null}
			controls={
				<>
					{canSetHeadline && !noteEditing && !isPanelCollapsed && (
						<EditorRow.NoteButton
							itemLabel={entityTypeLabel}
							hasNote={!!entity.headline}
							disabled={readonly}
							onClick={() => setNoteEditing(true)}
						/>
					)}
					<EditorRow.DuplicateButton
						itemLabel={entityTypeLabel}
						disabled={readonly}
						onClick={service.performDuplicate}
					/>
					<EditorRow.RemoveButton itemLabel={entityTypeLabel} disabled={readonly} onClick={service.performDelete} />
					{!!service.setEnabled && (
						<EditorRow.EnabledSwitch
							itemLabel={entityTypeLabel}
							enabled={!entity.disabled}
							setEnabled={service.setEnabled}
						/>
					)}
					{canCollapse && (
						<EditorRow.CollapseButton
							itemLabel={entityTypeLabel}
							isCollapsed={isPanelCollapsed}
							onClick={toggleCollapse}
						/>
					)}
				</>
			}
		>
			{connectionLabel && <EditorRow.Badge>{connectionLabel}</EditorRow.Badge>}

			<div className="flex flex-col flex-1 min-w-0 gap-0.5">
				{localVariableValueName !== null && localVariablesStore ? (
					<div className="cell-name-local-variable">
						<span className="cell-name-local-variable-label font-semibold text-xs text-body" title={cleanHeadline}>
							{cleanHeadline}
						</span>
						<div className="cell-name-local-variable-value">
							<VariableValueDisplayPopover
								value={localVariablesStore.getValue(localVariableValueName)}
								showCopy={false}
							/>
						</div>
					</div>
				) : (
					<EditorRow.Title isCollapsed={isPanelCollapsed}>{cleanHeadline}</EditorRow.Title>
				)}

				{!isCollapsedLocalVariable && (
					<EditorRow.Headline
						headline={entity.headline}
						setHeadline={service.setHeadline ?? null}
						editing={noteEditing}
						setEditing={setNoteEditing}
						placeholder={`Describe the intent of the ${entityTypeLabel}`}
						isCollapsed={isPanelCollapsed}
						readonly={readonly}
					/>
				)}
			</div>
		</EditorRow.Header>
	)
})
