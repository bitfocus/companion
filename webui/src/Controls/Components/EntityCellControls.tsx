import { faChevronDown, faPencil, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useRef, useState, type FocusEvent } from 'react'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType, type EntityOwner, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { Button } from '~/Components/Button.js'
import { DuplicateIcon } from '~/Components/DuplicateIcon.js'
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
	const noteInputRef = useRef<HTMLDivElement>(null)
	const clearNoteRef = useRef<HTMLButtonElement>(null)

	// Tabbing between the note field and its clear button keeps the note open
	const onNoteBlur = useCallback((event: FocusEvent) => {
		const next = event.relatedTarget
		if (next instanceof Node && (noteInputRef.current?.contains(next) || clearNoteRef.current?.contains(next))) return
		setNoteEditing(false)
	}, [])

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

	const isNoteEditing = !isCollapsedLocalVariable && noteEditing && !isPanelCollapsed && !!service.setHeadline
	const wrapClass = isPanelCollapsed ? 'truncate' : 'whitespace-normal break-words'

	return (
		<div className="editor-grid-header flex items-center justify-between gap-3">
			{/* Left section: connection badge, name, and any compact status indicators */}
			<div
				className={`flex items-center gap-2.5 flex-1 min-w-0 select-none py-0.5 ${canCollapse ? 'cursor-pointer' : ''}`}
				onClick={(e) => {
					// Don't toggle if user clicked inside an input
					if ((e.target as HTMLElement).closest('input, textarea, button')) return
					toggleCollapse()
				}}
			>
				{connectionLabel && (
					<span
						className="px-1.5 py-0.5 rounded text-3xs font-semibold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20 shrink-0 truncate cell-connection-label"
						title={connectionLabel}
					>
						{connectionLabel}
					</span>
				)}

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
					) : isCollapsedLocalVariable || !(isNoteEditing || entity.headline) ? (
						<span className={`font-semibold text-xs text-body leading-tight ${wrapClass}`} title={cleanHeadline}>
							{cleanHeadline}
						</span>
					) : (
						// A note says what this is for, so it leads and the definition it runs follows
						<>
							{isNoteEditing && service.setHeadline ? (
								<div
									ref={noteInputRef}
									className="px-0.5 py-0.5"
									onClick={(e) => e.stopPropagation()}
									onBlur={onNoteBlur}
								>
									<TextInputFieldSimple
										id={undefined}
										value={entity.headline ?? ''}
										placeholder={`Describe the intent of the ${entityTypeLabel}`}
										setValue={service.setHeadline}
										autoFocus
										onKeyDown={(event) => {
											if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
										}}
									/>
								</div>
							) : (
								<Button
									variant="inline"
									disabled={readonly || isPanelCollapsed || !service.setHeadline}
									onClick={(event) => {
										event.stopPropagation()
										setNoteEditing(true)
									}}
									className={`w-fit max-w-full leading-tight p-0 text-left text-xs font-semibold text-body disabled:cursor-default disabled:pointer-events-auto ${wrapClass}`}
									title={isPanelCollapsed ? entity.headline : `Edit note: ${entity.headline}`}
								>
									{entity.headline}
								</Button>
							)}
							<span className={`text-3xs text-muted leading-snug ${wrapClass}`} title={cleanHeadline}>
								{cleanHeadline}
							</span>
						</>
					)}
				</div>
			</div>

			{/* Right section: Clean ghost buttons + switch toggle + smooth accordion caret */}
			<div className="cell-controls flex items-center gap-0.5 shrink-0">
				{canSetHeadline && !noteEditing && !isPanelCollapsed && (
					<Button
						variant="ghost"
						size="sm"
						disabled={readonly}
						onClick={() => setNoteEditing(true)}
						title={entity.headline ? 'Edit note' : `Add note to ${entityTypeLabel}`}
						className="p-1.5"
					>
						<FontAwesomeIcon icon={faPencil} className="text-xs" />
					</Button>
				)}
				{isNoteEditing && service.setHeadline && (
					<Button
						ref={clearNoteRef}
						variant="ghost"
						size="sm"
						disabled={readonly || !entity.headline}
						// Keep the note field focused, so blurring it doesn't remove this button before the click lands
						onMouseDown={(event) => event.preventDefault()}
						onBlur={onNoteBlur}
						onClick={() => {
							service.setHeadline?.('')
							setNoteEditing(false)
						}}
						title="Clear note"
						className="p-1.5"
					>
						<FontAwesomeIcon icon={faXmark} className="text-xs" />
					</Button>
				)}

				<Button
					variant="ghost"
					size="sm"
					disabled={readonly}
					onClick={service.performDuplicate}
					title={`Duplicate ${entityTypeLabel}`}
					className="p-1.5"
				>
					<DuplicateIcon />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					disabled={readonly}
					onClick={service.performDelete}
					title={`Remove ${entityTypeLabel}`}
					className="p-1.5"
					color="danger"
				>
					<FontAwesomeIcon icon={faTrash} className="text-xs" />
				</Button>

				{!!service.setEnabled && (
					<div className="ms-1.5 me-1 flex items-center">
						<SwitchInputField
							id={undefined}
							value={!entity.disabled}
							tooltip={entity.disabled ? `Enable ${entityTypeLabel}` : `Disable ${entityTypeLabel}`}
							setValue={service.setEnabled}
							small
						/>
					</div>
				)}

				{canCollapse && (
					<Button
						variant="ghost"
						size="sm"
						onClick={toggleCollapse}
						title={isPanelCollapsed ? `Expand ${entityTypeLabel}` : `Collapse ${entityTypeLabel}`}
						className="p-1.5"
					>
						<FontAwesomeIcon
							icon={faChevronDown}
							className={`text-xs transition-transform duration-200 ${isPanelCollapsed ? '-rotate-90' : 'rotate-0'}`}
						/>
					</Button>
				)}
			</div>
		</div>
	)
})
