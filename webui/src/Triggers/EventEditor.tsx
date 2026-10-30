import { useDragDropMonitor } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useRef } from 'react'
import type { JsonValue } from 'type-fest'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { optionsObjectToExpressionOptions, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { EditorRow, useNoteEditor } from '~/Components/EditorRow.js'
import { Form } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { ListHeading } from '~/Components/ListHeading.js'
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
				<ListHeading
					heading={heading}
					subheading={subheading}
					actions={null}
					collapse={
						events.length > 1
							? {
									canExpandAll: panelCollapseHelper.canExpandAll(),
									canCollapseAll: panelCollapseHelper.canCollapseAll(),
									expandAll: panelCollapseHelper.setAllExpanded,
									collapseAll: panelCollapseHelper.setAllCollapsed,
								}
							: null
					}
				/>
			)}

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
		<EditorRow.Root rowRef={rowRef} dragRef={dragRef} disabled={!event.enabled} isDragging={false}>
			<EventEditor
				event={event}
				service={service}
				panelCollapseHelper={panelCollapseHelper}
				localVariablesStore={localVariablesStore}
			/>
		</EditorRow.Root>
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
	const note = useNoteEditor()
	const doEditHeadline = useCallback(() => note.setEditing(true), [note])

	const doCollapse = useCallback(() => {
		note.setEditing(false)
		panelCollapseHelper.setPanelCollapsed(event.id, true)
	}, [panelCollapseHelper, event.id, note])
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
			<EditorRow.Header
				onToggleCollapsed={hasDetails ? (isCollapsed ? doExpand : doCollapse) : null}
				controls={
					<>
						{canSetHeadline && !note.editing && !isCollapsed && (
							<EditorRow.NoteButton itemLabel="event" hasNote={!!headline} disabled={false} onClick={doEditHeadline} />
						)}
						{note.editing && !isCollapsed && service.setHeadline && (
							<EditorRow.ClearNoteButton note={note} setHeadline={service.setHeadline} disabled={!headline} />
						)}
						<EditorRow.DuplicateButton itemLabel="event" disabled={false} onClick={service.performDuplicate} />
						<EditorRow.RemoveButton itemLabel="event" disabled={false} onClick={service.performDelete} />
						{!!service.setEnabled && (
							<EditorRow.EnabledSwitch itemLabel="event" enabled={event.enabled} setEnabled={service.setEnabled} />
						)}
						{hasDetails && (
							<EditorRow.CollapseButton
								itemLabel="event"
								isCollapsed={isCollapsed}
								onClick={isCollapsed ? doExpand : doCollapse}
							/>
						)}
					</>
				}
			>
				<div className="flex flex-col flex-1 min-w-0 gap-0.5">
					<EditorRow.Name
						title={name}
						headline={headline}
						setHeadline={service.setHeadline ?? null}
						note={note}
						placeholder="Describe the intent of the event"
						isCollapsed={isCollapsed}
						readonly={false}
					/>
				</div>
			</EditorRow.Header>

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
