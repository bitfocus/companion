import { CButton, CForm, CButtonGroup, CSwitch } from '@coreui/react'
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
import { MyErrorBoundary, EventDefinitionsContext, PreventDefaultHandler } from '../util.js'
import { OptionsInputField } from '../Controls/OptionsInputField.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper.js'
import type { EventInstance } from '@companion/shared/Model/EventModel.js'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible.js'
import { TextInputField } from '../Components/TextInputField.js'
import { AddEventDropdown } from './AddEventDropdown.js'
import {
	IEventEditorEventService,
	IEventEditorService,
	useControlEventService,
	useControlEventsEditorService,
} from '../Services/Controls/ControlEventsService.js'

interface TriggerEventEditorProps {
	controlId: string
	events: EventInstance[]
	heading: JSX.Element | string
}

export function TriggerEventEditor({ controlId, events, heading }: TriggerEventEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const eventsService = useControlEventsEditorService(controlId, confirmModal)

	const eventsRef = useRef<EventInstance[]>()
	eventsRef.current = events

	const eventIds = useMemo(() => events.map((ev) => ev.id), [events])
	const { setPanelCollapsed, isPanelCollapsed, setAllCollapsed, setAllExpanded, canExpandAll, canCollapseAll } =
		usePanelCollapseHelper(`events_${controlId}`, eventIds)

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<h4 className="mt-3">
				{heading}
				{events.length > 1 && (
					<CButtonGroup className="right">
						<CButtonGroup>
							{canExpandAll && (
								<CButton size="sm" onClick={setAllExpanded} title="Expand all events">
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							)}
							{canCollapseAll && (
								<CButton size="sm" onClick={setAllCollapsed} title="Collapse all events">
									<FontAwesomeIcon icon={faCompressArrowsAlt} />
								</CButton>
							)}
						</CButtonGroup>
					</CButtonGroup>
				)}
			</h4>

			<table className="table feedback-table">
				<tbody>
					{events.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<EventsTableRow
								key={a?.id ?? i}
								index={i}
								event={a}
								dragId={`events_${controlId}`}
								serviceFactory={eventsService}
								setCollapsed={setPanelCollapsed}
								isCollapsed={isPanelCollapsed(a.id)}
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
}

interface EventsTableRowDragObject {
	index: number
}
interface EventsTableRowDragCollection {
	isDragging: boolean
}

interface EventsTableRowProps {
	event: EventInstance
	index: number
	dragId: string
	serviceFactory: IEventEditorService

	isCollapsed: boolean
	setCollapsed: (eventId: string, collapsed: boolean) => void
}

function EventsTableRow({
	event,
	index,
	dragId,
	serviceFactory,
	isCollapsed,
	setCollapsed,
}: EventsTableRowProps): JSX.Element | null {
	const service = useControlEventService(serviceFactory, event)

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<EventsTableRowDragObject>({
		accept: dragId,
		hover(item, _monitor) {
			if (!ref.current) {
				return
			}
			const dragIndex = item.index
			const hoverIndex = index
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
	})
	const [{ isDragging }, drag, preview] = useDrag<EventsTableRowDragObject, never, EventsTableRowDragCollection>({
		type: dragId,
		item: {
			index: index,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	const doCollapse = useCallback(() => setCollapsed(event.id, true), [setCollapsed, event.id])
	const doExpand = useCallback(() => setCollapsed(event.id, false), [setCollapsed, event.id])

	if (!event) {
		// Invalid event, so skip
		return null
	}

	return (
		<tr ref={ref} className={isDragging ? 'feedbacklist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				<EventEditor
					event={event}
					service={service}
					isCollapsed={isCollapsed}
					doCollapse={doCollapse}
					doExpand={doExpand}
				/>
			</td>
		</tr>
	)
}

interface EventEditorProps {
	event: EventInstance
	service: IEventEditorEventService
	isCollapsed: boolean
	doCollapse: () => void
	doExpand: () => void
}

function EventEditor({ event, service, isCollapsed, doCollapse, doExpand }: EventEditorProps) {
	const EventDefinitions = useContext(EventDefinitionsContext)

	const eventSpec = EventDefinitions[event.type]

	const [eventOptions, optionVisibility] = useOptionsAndIsVisible(eventSpec, event)

	const innerSetEnabled = useCallback(
		(e: FormEvent<HTMLInputElement>) => service.setEnabled(e.currentTarget.checked),
		[service.setEnabled]
	)

	const name = eventSpec ? eventSpec.name : `${event.type} (undefined)`

	const canSetHeadline = !!service.setHeadline
	const headline = event.headline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

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
								<CSwitch
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
					<div className="cell-description">
						{headlineExpanded && <p className="name">{name}</p>}
						{eventSpec?.description || ''}
					</div>

					<div className="cell-option">
						<CForm onSubmit={PreventDefaultHandler}>
							{eventOptions.map((opt, i) => (
								<MyErrorBoundary key={i}>
									<OptionsInputField
										key={i}
										isOnControl={false}
										isAction={false}
										connectionId={'internal'}
										option={opt}
										value={(event.options || {})[opt.id]}
										setValue={service.setValue}
										visibility={optionVisibility[opt.id] ?? true}
									/>
								</MyErrorBoundary>
							))}
						</CForm>
					</div>
				</div>
			)}
		</>
	)
}
