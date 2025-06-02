import { CButton, CForm, CButtonGroup, CFormSwitch, CCol } from '@coreui/react'
import {
	faSort,
	faTrash,
	faCompressArrowsAlt,
	faExpandArrowsAlt,
	faCopy,
	faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { FormEvent, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { DragState, MyErrorBoundary, PreventDefaultHandler, checkDragState } from '~/util.js'
import { OptionsInputField } from '~/Controls/OptionsInputField.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PanelCollapseHelperLite, usePanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { useOptionsAndIsVisible } from '~/Hooks/useOptionsAndIsVisible.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { AddEventDropdown } from './AddEventDropdown.js'
import {
	IEventEditorEventService,
	IEventEditorService,
	useControlEventService,
	useControlEventsEditorService,
} from '~/Services/Controls/ControlEventsService.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface TriggerEventEditorProps {
	controlId: string
	events: EventInstance[]
	heading: JSX.Element | string
}

export const TriggerEventEditor = observer(function TriggerEventEditor({
	controlId,
	events,
	heading,
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

			<table className="table entity-table">
				<tbody>
					{events.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<EventsTableRow
								key={a?.id ?? i}
								index={i}
								event={a}
								dragId={`events_${controlId}`}
								serviceFactory={eventsService}
								panelCollapseHelper={panelCollapseHelper}
							/>
						</MyErrorBoundary>
					))}
				</tbody>
			</table>

			<div className="add-dropdown-wrapper">
				<AddEventDropdown onSelect={eventsService.addEvent} />
			</div>
		</>
	)
})

interface EventsTableRowDragObject {
	index: number
	dragState: DragState | null
}
interface EventsTableRowDragCollection {
	isDragging: boolean
}

interface EventsTableRowProps {
	event: EventInstance
	index: number
	dragId: string
	serviceFactory: IEventEditorService
	panelCollapseHelper: PanelCollapseHelperLite
}

function EventsTableRow({
	event,
	index,
	dragId,
	serviceFactory,
	panelCollapseHelper,
}: EventsTableRowProps): JSX.Element | null {
	const service = useControlEventService(serviceFactory, event)

	const ref = useRef<HTMLTableRowElement>(null)
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
	const [{ isDragging }, drag, preview] = useDrag<EventsTableRowDragObject, never, EventsTableRowDragCollection>({
		type: dragId,
		item: {
			index: index,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	if (!event) {
		// Invalid event, so skip
		return null
	}

	return (
		<tr ref={ref} className={isDragging ? 'entitylist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				<EventEditor event={event} service={service} panelCollapseHelper={panelCollapseHelper} />
			</td>
		</tr>
	)
}

interface EventEditorProps {
	event: EventInstance
	service: IEventEditorEventService
	panelCollapseHelper: PanelCollapseHelperLite
}

const EventEditor = observer(function EventEditor({ event, service, panelCollapseHelper }: EventEditorProps) {
	const { eventDefinitions } = useContext(RootAppStoreContext)

	const eventSpec = eventDefinitions.definitions[event.type]

	const [eventOptions, optionVisibility] = useOptionsAndIsVisible(eventSpec?.options, event?.options)

	const innerSetEnabled = useCallback(
		(e: FormEvent<HTMLInputElement>) => service.setEnabled(e.currentTarget.checked),
		[service.setEnabled]
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
							<FontAwesomeIcon icon={faCopy} />
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

					<CForm className="row g-3" onSubmit={PreventDefaultHandler}>
						{eventOptions.map((opt, i) => (
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
									localVariablesStore={null}
								/>
							</MyErrorBoundary>
						))}
					</CForm>
				</div>
			)}
		</>
	)
})
