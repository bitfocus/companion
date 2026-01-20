import { CButton, CForm, CButtonGroup, CFormSwitch, CCol } from '@coreui/react'
import {
	faSort,
	faTrash,
	faCompressArrowsAlt,
	faExpandArrowsAlt,
	faClone,
	faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react'
import classNames from 'classnames'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { checkDragState, type DragState } from '~/Resources/DragAndDrop.js'
import { OptionsInputField } from '~/Controls/OptionsInputField.js'
import { useDrag, useDrop, useDragLayer } from 'react-dnd'
import { getEmptyImage } from 'react-dnd-html5-backend'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { usePanelCollapseHelperLite, type PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { useOptionsVisibility } from '~/Hooks/useOptionsAndIsVisible.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { AddEventDropdown } from './AddEventDropdown.js'
import {
	useControlEventService,
	useControlEventsEditorService,
	type IEventEditorEventService,
	type IEventEditorService,
} from '~/Services/Controls/ControlEventsService.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'

interface TriggerEventEditorProps {
	controlId: string
	events: EventInstance[]
	heading: JSX.Element | string
	localVariablesStore: LocalVariablesStore
}

export const TriggerEventEditor = observer(function TriggerEventEditor({
	controlId,
	events,
	heading,
	localVariablesStore,
}: TriggerEventEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const eventsService = useControlEventsEditorService(controlId, confirmModal)

	const eventsRef = useRef<EventInstance[]>()
	eventsRef.current = events

	const eventIds = useMemo(() => events.map((ev) => ev.id), [events])
	const panelCollapseHelper = usePanelCollapseHelperLite(`events_${controlId}`, eventIds)

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<h4 className="mt-3">
				{heading}
				{events.length > 1 && (
					<CButtonGroup className="right">
						<CButtonGroup>
							{panelCollapseHelper.canExpandAll() && (
								<CButton size="sm" onClick={panelCollapseHelper.setAllExpanded} title="Expand all events">
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							)}
							{panelCollapseHelper.canCollapseAll() && (
								<CButton size="sm" onClick={panelCollapseHelper.setAllCollapsed} title="Collapse all events">
									<FontAwesomeIcon icon={faCompressArrowsAlt} />
								</CButton>
							)}
						</CButtonGroup>
					</CButtonGroup>
				)}
			</h4>

			<EventListDragLayer
				events={events}
				dragId={`events_${controlId}`}
				serviceFactory={eventsService}
				panelCollapseHelper={panelCollapseHelper}
				localVariablesStore={localVariablesStore}
			/>
			<div className="entity-list">
				{events.map((a, i) => (
					<MyErrorBoundary key={a?.id ?? i}>
						<EventsTableRow
							key={a?.id ?? i}
							index={i}
							event={a}
							dragId={`events_${controlId}`}
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

interface EventsTableRowDragObject {
	eventId: string
	index: number
	dragState: DragState | null
	width?: number
}
interface EventsTableRowDragCollection {
	isDragging: boolean
}

interface EventEditorRowContentProps {
	event: EventInstance
	serviceFactory: IEventEditorService
	panelCollapseHelper: PanelCollapseHelperLite
	localVariablesStore: LocalVariablesStore

	isDragging: boolean
	rowRef: React.LegacyRef<HTMLDivElement> | null
	dragRef: React.LegacyRef<HTMLDivElement> | null
}

const EventEditorRowContent = observer(function EventEditorRowContent({
	event,
	serviceFactory,
	panelCollapseHelper,
	localVariablesStore,
	isDragging,
	rowRef,
	dragRef,
}: EventEditorRowContentProps): JSX.Element {
	const service = useControlEventService(serviceFactory, event)

	return (
		<div ref={rowRef} className={classNames('entity-row', { 'entitylist-dragging': isDragging })}>
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
}: EventsTableRowProps): JSX.Element | null {
	const ref = useRef<HTMLDivElement>(null)
	const [, drop] = useDrop<EventsTableRowDragObject>({
		accept: dragId,
		hover(item, monitor) {
			if (!ref.current) {
				return
			}

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			const dragIndex = item.index
			const hoverIndex = index
			const hoverId = event.id

			if (!checkDragState(item, monitor, hoverId)) return

			// Don't replace items with themselves
			if (dragIndex === hoverIndex) {
				return
			}

			// Time to actually perform the action
			serviceFactory.moveCard(dragIndex, hoverIndex)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
		},
		drop(item, _monitor) {
			item.dragState = null
		},
	})

	const [_c, drag, preview] = useDrag<EventsTableRowDragObject, never, EventsTableRowDragCollection>({
		type: dragId,
		item: () => ({
			eventId: event.id,
			index: index,
			dragState: null,
			width: ref.current?.offsetWidth,
		}),
	})

	// Check if the current item is being dragged
	const { draggingItem } = useDragLayer((monitor) => ({
		draggingItem: monitor.getItem<EventsTableRowDragObject>(),
	}))
	const isDragging = draggingItem?.eventId === event.id

	// Hide default browser drag preview
	useEffect(() => {
		preview(getEmptyImage(), { captureDraggingState: true })
	}, [preview])

	// Connect drag and drop
	drop(ref)

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
			isDragging={isDragging}
			dragRef={drag}
			rowRef={ref}
		/>
	)
}

interface EventListDragLayerProps {
	events: EventInstance[]
	dragId: string
	serviceFactory: IEventEditorService
	panelCollapseHelper: PanelCollapseHelperLite
	localVariablesStore: LocalVariablesStore
}

const EventListDragLayer = observer(function EventListDragLayer({
	events,
	dragId,
	serviceFactory,
	panelCollapseHelper,
	localVariablesStore,
}: EventListDragLayerProps): JSX.Element | null {
	const { isDragging, item, currentOffset } = useDragLayer<{
		isDragging: boolean
		item: EventsTableRowDragObject | null
		currentOffset: { x: number; y: number } | null
	}>((monitor) => ({
		isDragging: monitor.isDragging() && monitor.getItemType() === dragId,
		item: monitor.getItem(),
		currentOffset: monitor.getSourceClientOffset(),
	}))

	if (!isDragging || !item || !currentOffset) {
		return null
	}

	const event = events.find((e) => e.id === item.eventId)
	if (!event) return null

	return (
		<div
			className="entity-list-drag-layer"
			style={{
				position: 'fixed',
				pointerEvents: 'none',
				zIndex: 100,
				left: 0,
				top: 0,
				transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
				width: item.width,
			}}
		>
			<EventEditorRowContent
				event={event}
				serviceFactory={serviceFactory}
				panelCollapseHelper={panelCollapseHelper}
				localVariablesStore={localVariablesStore}
				isDragging={true}
				rowRef={null}
				dragRef={null}
			/>
		</div>
	)
})

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

	const optionVisibility = useOptionsVisibility(eventSpec?.options, event?.options)

	const innerSetEnabled = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => service.setEnabled(e.currentTarget.checked),
		[service]
	)

	const name = eventSpec ? eventSpec.name : `${event.type} (undefined)`

	const canSetHeadline = !!service.setHeadline
	const headline = event.headline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

	const doCollapse = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(event.id, true),
		[panelCollapseHelper, event.id]
	)
	const doExpand = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(event.id, false),
		[panelCollapseHelper, event.id]
	)
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(event.id)

	return (
		<>
			<div className="editor-grid-header editor-grid-events">
				<div className="cell-name">
					{!service.setHeadline || !headlineExpanded || isCollapsed ? (
						headline || name
					) : (
						<TextInputField
							value={headline ?? ''}
							placeholder={'Describe the intent of the event'}
							setValue={service.setHeadline}
						/>
					)}
				</div>

				<div className="cell-controls">
					<CButtonGroup>
						{canSetHeadline && !headlineExpanded && (
							<CButton size="sm" onClick={doEditHeadline} title="Set headline">
								<FontAwesomeIcon icon={faPencil} />
							</CButton>
						)}
						{isCollapsed ? (
							<CButton size="sm" onClick={doExpand} title="Expand event view">
								<FontAwesomeIcon icon={faExpandArrowsAlt} />
							</CButton>
						) : (
							<CButton size="sm" onClick={doCollapse} title="Collapse event view">
								<FontAwesomeIcon icon={faCompressArrowsAlt} />
							</CButton>
						)}
						<CButton size="sm" onClick={service.performDuplicate} title="Duplicate event">
							<FontAwesomeIcon icon={faClone} />
						</CButton>
						<CButton size="sm" onClick={service.performDelete} title="Remove event">
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
						{!!service.setEnabled && (
							<>
								&nbsp;
								<CFormSwitch
									color="success"
									checked={event.enabled}
									title={event.enabled ? 'Disable event' : 'Enable event'}
									onChange={innerSetEnabled}
								/>
							</>
						)}
					</CButtonGroup>
				</div>
			</div>

			{!isCollapsed && (
				<div className="editor-grid editor-grid-events">
					<CCol sm={12} className="cell-description">
						{headlineExpanded && <p className="name">{name}</p>}
						{eventSpec?.description || ''}
					</CCol>

					<CForm className="row g-sm-2" onSubmit={PreventDefaultHandler}>
						{eventSpec?.options.map((opt, i) => (
							<MyErrorBoundary key={i}>
								<OptionsInputField
									key={i}
									isLocatedInGrid={false}
									entityType={null}
									connectionId={'internal'}
									option={opt}
									value={(event.options || {})[opt.id]}
									setValue={service.setValue}
									visibility={optionVisibility[opt.id] ?? true}
									localVariablesStore={localVariablesStore}
									fieldSupportsExpression={false} // Events do not support expressions
								/>
							</MyErrorBoundary>
						))}
					</CForm>
				</div>
			)}
		</>
	)
})
