import { faChevronDown, faClone, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { EntityOwner, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { Button } from '~/Components/Button.js'
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
	setPanelCollapsed: (collapsed: boolean) => void
	definitionName: string
	canSetHeadline: boolean
	headlineExpanded: boolean
	setHeadlineExpanded: () => void
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
	localVariablePrefix: string | null
}

function EntityOptionPills({
	entity,
	entityDefinition,
}: {
	entity: SomeEntityModel
	entityDefinition: ClientEntityDefinition | undefined
}) {
	const pills: { key: string; label?: string; value: string; isDelay?: boolean }[] = []

	// 1. Delay pill
	if ('delay' in entity && typeof entity.delay === 'number' && entity.delay > 0) {
		pills.push({
			key: 'delay',
			value: `⏱️ ${entity.delay}ms`,
			isDelay: true,
		})
	}

	// 2. Option pills
	if (entity.options && entityDefinition?.options) {
		for (const optDef of entityDefinition.options) {
			if (pills.length >= 3) break
			const rawVal: unknown = entity.options[optDef.id]
			if (rawVal === undefined || rawVal === '' || rawVal === false) continue

			let valStr = ''
			if (typeof rawVal === 'object' && rawVal !== null && 'isExpression' in rawVal) {
				const expVal = (rawVal as { value?: unknown }).value
				valStr = typeof expVal === 'string' || typeof expVal === 'number' ? `${expVal}` : JSON.stringify(expVal ?? '')
			} else if (typeof rawVal === 'boolean') {
				if (rawVal) valStr = optDef.label || optDef.id
			} else if (optDef.type === 'dropdown' && 'choices' in optDef && Array.isArray(optDef.choices)) {
				const rawStr = typeof rawVal === 'string' || typeof rawVal === 'number' ? `${rawVal}` : ''
				const choice = optDef.choices.find((c) => `${c.id}` === rawStr)
				valStr = choice?.label ?? rawStr
			} else if (typeof rawVal === 'string' || typeof rawVal === 'number') {
				valStr = `${rawVal}`
			} else {
				valStr = JSON.stringify(rawVal)
			}

			if (valStr) {
				pills.push({
					key: optDef.id,
					label: optDef.label,
					value: valStr,
				})
			}
		}
	}

	if (pills.length === 0) return null

	return (
		<div className="flex items-center gap-1.5 flex-wrap">
			{pills.map((pill) => (
				<span
					key={pill.key}
					className={`inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-medium ${
						pill.isDelay
							? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold'
							: 'bg-surface-muted text-muted border border-border/70'
					}`}
				>
					{pill.label && <span className="opacity-60 mr-1">{pill.label}:</span>}
					<span className="font-semibold text-body truncate entity-pill-value">{pill.value}</span>
				</span>
			))}
		</div>
	)
}

export const EntityRowHeader = observer(function EntityRowHeader({
	service,
	entityTypeLabel,
	entity,
	entityDefinition,
	connectionLabel,
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
	const toggleCollapse = useCallback(() => setPanelCollapsed(!isPanelCollapsed), [isPanelCollapsed, setPanelCollapsed])

	// When a local variable is collapsed, show its name and current value instead of the definition name
	const { headline, localVariableValueName } = getEntityRowHeaderDisplay(
		entity,
		ownerId,
		definitionName,
		isPanelCollapsed,
		localVariablePrefix
	)

	let cleanHeadline = headline
	if (connectionLabel && cleanHeadline.toLowerCase().startsWith(`${connectionLabel.toLowerCase()}:`)) {
		cleanHeadline = cleanHeadline.slice(connectionLabel.length + 1).trim()
	}

	return (
		<div className="editor-grid-header flex items-center justify-between gap-3">
			{/* Left section: Connection badge + Title + Parameter Pills */}
			<div
				className="flex items-center gap-2.5 grow min-w-0 cursor-pointer select-none py-0.5"
				onClick={(e) => {
					// Don't toggle if user clicked inside an input
					if ((e.target as HTMLElement).closest('input, textarea, button')) return
					toggleCollapse()
				}}
			>
				{connectionLabel && (
					<span className="px-1.5 py-0.5 rounded text-3xs font-semibold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20 shrink-0">
						{connectionLabel}
					</span>
				)}

				{!service.setHeadline || !headlineExpanded || isPanelCollapsed ? (
					<>
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
							<span className="font-semibold text-xs text-body truncate">{cleanHeadline}</span>
						)}

						{entity.headline && (
							<span
								className="text-3xs font-mono text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 truncate entity-value-pill"
								title={`Note: ${entity.headline}`}
							>
								// {entity.headline}
							</span>
						)}
					</>
				) : (
					<div className="grow list-toolbar-search" onClick={(e) => e.stopPropagation()}>
						<TextInputFieldSimple
							id={undefined}
							value={entity.headline ?? ''}
							placeholder={`Describe the intent of the ${entityTypeLabel}`}
							setValue={service.setHeadline}
						/>
					</div>
				)}

				{isPanelCollapsed && <EntityOptionPills entity={entity} entityDefinition={entityDefinition} />}
			</div>

			{/* Right section: Clean ghost buttons + switch toggle + smooth accordion caret */}
			<div className="cell-controls flex items-center gap-0.5 shrink-0">
				{canSetHeadline && !headlineExpanded && !isPanelCollapsed && (
					<Button
						variant="ghost"
						size="sm"
						onClick={setHeadlineExpanded}
						title="Set headline / note"
						className="text-muted hover:text-body p-1.5"
					>
						<FontAwesomeIcon icon={faPencil} className="text-xs" />
					</Button>
				)}

				<Button
					variant="ghost"
					size="sm"
					disabled={readonly}
					onClick={service.performDuplicate}
					title={`Duplicate ${entityTypeLabel}`}
					className="text-muted hover:text-body p-1.5"
				>
					<FontAwesomeIcon icon={faClone} className="text-xs" />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					disabled={readonly}
					onClick={service.performDelete}
					title={`Remove ${entityTypeLabel}`}
					className="text-muted hover:text-danger p-1.5"
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

				<Button
					variant="ghost"
					size="sm"
					onClick={toggleCollapse}
					title={isPanelCollapsed ? `Expand ${entityTypeLabel}` : `Collapse ${entityTypeLabel}`}
					className="text-muted hover:text-body p-1.5"
				>
					<FontAwesomeIcon
						icon={faChevronDown}
						className={`text-xs transition-transform duration-200 ${isPanelCollapsed ? '-rotate-90' : 'rotate-0'}`}
					/>
				</Button>
			</div>
		</div>
	)
})
