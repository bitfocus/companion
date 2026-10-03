import { useDragDropMonitor } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { faAnglesDown, faAnglesUp, faChevronDown, faPencil, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { JsonValue } from 'type-fest'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { optionsObjectToExpressionOptions, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { Button } from '~/Components/Button'
import { DuplicateIcon } from '~/Components/DuplicateIcon.js'
import { Form } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { OptionsInputField } from '~/Controls/OptionsInputField.js'
import { usePanelCollapseHelperLite, type PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import { useOptionsVisibility } from '~/Hooks/useOptionsAndIsVisible.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import {
	useControlEventsEditorService,
	useControlEventService,
	type IEventEditorEventService,
	type IEventEditorService,
} from '~/Services/Controls/ControlEventsService.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { AddEventDropdown } from './AddEventDropdown.js'

interface TriggerEventEditorProps {
	controlId: string
	events: EventInstance[]
	heading: React.JSX.Element | string
	subheading?: React.ReactNode
	localVariablesStore: LocalVariablesStore
}

export const TriggerEventEditor = observer(function TriggerEventEditor({
	controlId,
	events,
	heading,
	subheading,
	localVariablesStore,
}: TriggerEventEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const eventsService = useControlEventsEditorService(controlId, confirmModal)

	const eventIds = useMemo(() => events.map((ev) => ev.id), [events])
	const panelCollapseHelper = usePanelCollapseHelperLite(`events_${controlId}`, eventIds, false, {
		kind: 'control',
		id: controlId,
	})

	const dragId = `events_${controlId}`
	useDragDropMonitor({
		onDragEnd(event) {
			if (event.canceled) return
			const { source } = event.operation
			if (!source || source.type !== dragId || !isSortable(source)) return
			const { initialIndex, index } = source
			if (initialIndex === index) return
			eventsService.moveCard(initialIndex, index)
		},
	})

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			{heading && (
				<div className="flex items-center justify-between gap-2 mt-3 mb-2">
					<div className="text-sm font-semibold text-body">{heading}</div>
					{events.length > 1 && (
						<div className="flex items-center gap-1 shrink-0">
							{panelCollapseHelper.canExpandAll() && (
								<Button
									variant="ghost"
									size="sm"
									onClick={panelCollapseHelper.setAllExpanded}
									title="Expand all events"
									className="text-xs px-2 py-0.5 flex items-center gap-1.5"
								>
									<FontAwesomeIcon icon={faAnglesDown} className="text-2xs" />
									<span className="text-3xs font-medium">Expand all</span>
								</Button>
							)}
							{panelCollapseHelper.canCollapseAll() && (
								<Button
									variant="ghost"
									size="sm"
									onClick={panelCollapseHelper.setAllCollapsed}
									title="Collapse all events"
									className="text-xs px-2 py-0.5 flex items-center gap-1.5"
								>
									<FontAwesomeIcon icon={faAnglesUp} className="text-2xs" />
									<span className="text-3xs font-medium">Collapse all</span>
								</Button>
							)}
						</div>
					)}
				</div>
			)}
			{subheading}

			<div className="entity-list">
				{events.map((a, i) => (
					<MyErrorBoundary key={a?.id ?? i}>
						<EventsTableRow
							key={a?.id ?? i}
							index={i}
							event={a}
							dragId={dragId}
							serviceFactory={eventsService}
							panelCollapseHelper={panelCollapseHelper}
							localVariablesStore={localVariablesStore}
						/>
					</MyErrorBoundary>
				))}
			</div>

			<div className="add-dropdown-wrapper">
				<AddEventDropdown onSelect={eventsService.addEvent} />
			</div>
		</>
	)
})

interface EventEditorRowContentProps {
	event: EventInstance
	serviceFactory: IEventEditorService
	panelCollapseHelper: PanelCollapseHelperLite
	localVariablesStore: LocalVariablesStore

	rowRef: (element: Element | null) => void
	dragRef: (element: Element | null) => void
}

const EventEditorRowContent = observer(function EventEditorRowContent({
	event,
	serviceFactory,
	panelCollapseHelper,
	localVariablesStore,
	rowRef,
	dragRef,
}: EventEditorRowContentProps): React.JSX.Element {
	const service = useControlEventService(serviceFactory, event)

	return (
		<div
			ref={rowRef}
			className={classNames('entity-row', {
				'entity-disabled': !event.enabled,
			})}
		>
			<div ref={dragRef} className="entity-row-reorder">
				<FontAwesomeIcon icon={faSort} />
			</div>
			<div className="entity-row-content">
				<EventEditor
					event={event}
					service={service}
					panelCollapseHelper={panelCollapseHelper}
					localVariablesStore={localVariablesStore}
				/>
			</div>
		</div>
	)
})

interface EventsTableRowProps {
	event: EventInstance
	index: number
	dragId: string
	serviceFactory: IEventEditorService
	panelCollapseHelper: PanelCollapseHelperLite
	localVariablesStore: LocalVariablesStore
}

function EventsTableRow({
	event,
	index,
	dragId,
	serviceFactory,
	panelCollapseHelper,
	localVariablesStore,
}: EventsTableRowProps): React.JSX.Element | null {
	// transition:null makes swaps instant (no 250ms slide). Direction-lock hysteresis that stops
	// short-past-tall jitter is handled globally by <SortableHysteresis> in App.tsx.
	const { ref, handleRef } = useSortable({
		id: event.id,
		index,
		type: dragId,
		accept: dragId,
		transition: null,
	})

	if (!event) {
		// Invalid event, so skip
		return null
	}

	return (
		<EventEditorRowContent
			event={event}
			serviceFactory={serviceFactory}
			panelCollapseHelper={panelCollapseHelper}
			localVariablesStore={localVariablesStore}
			dragRef={handleRef}
			rowRef={ref}
		/>
	)
}

interface EventEditorProps {
	event: EventInstance
	service: IEventEditorEventService
	panelCollapseHelper: PanelCollapseHelperLite
	localVariablesStore: LocalVariablesStore
}

const EventEditor = observer(function EventEditor({
	event,
	service,
	panelCollapseHelper,
	localVariablesStore,
}: EventEditorProps) {
	const { eventDefinitions } = useContext(RootAppStoreContext)

	const eventSpec = eventDefinitions.definitions.get(event.type)

	const name = eventSpec ? eventSpec.name : `${event.type} (undefined)`
	const hasDetails = !!eventSpec?.description?.trim() || !!eventSpec?.options.length

	const canSetHeadline = !!service.setHeadline
	const headline = event.headline
	const [noteEditing, setNoteEditing] = useState(false)
	const doEditHeadline = useCallback(() => setNoteEditing(true), [])

	const doCollapse = useCallback(() => {
		setNoteEditing(false)
		panelCollapseHelper.setPanelCollapsed(event.id, true)
	}, [panelCollapseHelper, event.id])
	const doExpand = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(event.id, false),
		[panelCollapseHelper, event.id]
	)
	const isCollapsed = hasDetails && panelCollapseHelper.isPanelCollapsed(event.id)

	// Events don't support expressions, so we have to pretend for the UI
	const wrappedOptions = optionsObjectToExpressionOptions(event.options || {}, false)
	const setWrappedValue = useCallback(
		(key: string, value: ExpressionOrValue<JsonValue | undefined>) => service.setValue(key, value.value),
		[service]
	)

	const optionVisibility = useOptionsVisibility(eventSpec?.options, false, wrappedOptions)

	return (
		<>
			<div className="editor-grid-header flex items-center justify-between gap-3">
				<div className="flex flex-col grow min-w-0 gap-0.5">
					<span className="font-semibold text-xs text-body whitespace-normal break-words leading-tight">{name}</span>
					{noteEditing && !isCollapsed && service.setHeadline ? (
						<div className="px-0.5 py-0.5">
							<TextInputFieldSimple
								id={undefined}
								value={headline ?? ''}
								placeholder="Describe the intent of the event"
								setValue={service.setHeadline}
								aria-label="Event headline"
								autoFocus
								onBlur={() => setNoteEditing(false)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
								}}
							/>
						</div>
					) : headline ? (
						<button
							type="button"
							disabled={isCollapsed || !service.setHeadline}
							onClick={doEditHeadline}
							className="w-fit max-w-full whitespace-normal break-words leading-snug border-0 bg-transparent p-0 text-left text-3xs font-normal text-action-text hover:text-body disabled:hover:text-action-text disabled:cursor-default"
							title={isCollapsed ? headline : `Edit note: ${headline}`}
						>
							{headline}
						</button>
					) : null}
				</div>

				<div className="cell-controls flex items-center gap-0.5 shrink-0">
					{canSetHeadline && !noteEditing && !isCollapsed && (
						<Button
							variant="ghost"
							size="sm"
							className="p-1.5"
							onClick={doEditHeadline}
							title={headline ? 'Edit note' : 'Add note to event'}
						>
							<FontAwesomeIcon icon={faPencil} className="text-xs" />
						</Button>
					)}
					<Button
						variant="ghost"
						size="sm"
						className="p-1.5"
						onClick={service.performDuplicate}
						title="Duplicate event"
					>
						<DuplicateIcon />
					</Button>
					<Button
						size="sm"
						className="p-1.5"
						onClick={service.performDelete}
						title="Remove event"
						variant="ghost"
						color="danger"
					>
						<FontAwesomeIcon icon={faTrash} className="text-xs" />
					</Button>
					{!!service.setEnabled && (
						<div className="ms-1.5 me-1 flex items-center">
							<SwitchInputField
								id={undefined}
								value={event.enabled}
								tooltip={event.enabled ? 'Disable event' : 'Enable event'}
								setValue={service.setEnabled}
								small
							/>
						</div>
					)}
					{hasDetails && (
						<Button
							variant="ghost"
							size="sm"
							className="p-1.5"
							onClick={isCollapsed ? doExpand : doCollapse}
							title={isCollapsed ? 'Expand event view' : 'Collapse event view'}
						>
							<FontAwesomeIcon
								icon={faChevronDown}
								className={`text-xs transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
							/>
						</Button>
					)}
				</div>
			</div>

			{hasDetails && !isCollapsed && (
				<div className="editor-grid">
					<Grid.Col sm={12} className="cell-description">
						{eventSpec?.description || ''}
					</Grid.Col>

					<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
						{eventSpec?.options.map((opt, i) => (
							<MyErrorBoundary key={i}>
								<OptionsInputField
									key={i}
									isLocatedInGrid={false}
									entityType={null}
									allowInternalFields={true}
									option={opt}
									value={wrappedOptions[opt.id]}
									setValue={setWrappedValue}
									visibility={optionVisibility.get(opt.id) ?? true}
									localVariablesStore={localVariablesStore}
									fieldSupportsExpression={false} // Events do not support expressions
								/>
							</MyErrorBoundary>
						))}
					</Form>
				</div>
			)}
		</>
	)
})
