import { CButton, CForm, CButtonGroup, CSwitch } from '@coreui/react'
import { faSort, faTrash, faCompressArrowsAlt, faExpandArrowsAlt, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { FormEvent, memo, useCallback, useContext, useMemo, useRef } from 'react'
import {
	MyErrorBoundary,
	socketEmitPromise,
	SocketContext,
	EventDefinitionsContext,
	PreventDefaultHandler,
} from '../util.js'
import Select from 'react-select'
import { OptionsInputField } from '../Controls/OptionsInputField.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper.js'
import { MenuPortalContext } from '../Components/DropdownInputField.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import type { EventInstance } from '@companion/shared/Model/EventModel.js'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible.js'

interface TriggerEventEditorProps {
	controlId: string
	events: EventInstance[]
	heading: JSX.Element | string
}

export function TriggerEventEditor({ controlId, events, heading }: TriggerEventEditorProps) {
	const socket = useContext(SocketContext)

	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const eventsRef = useRef<EventInstance[]>()
	eventsRef.current = events

	const setValue = useCallback(
		(eventId: string, key: string, val: any) => {
			const currentEvent = eventsRef.current?.find((fb) => fb.id === eventId)
			if (!currentEvent?.options || currentEvent.options[key] !== val) {
				socketEmitPromise(socket, 'controls:event:set-option', [controlId, eventId, key, val]).catch((e) => {
					console.error(`Set-option failed: ${e}`)
				})
			}
		},
		[socket, controlId]
	)

	const doDelete = useCallback(
		(eventId: string) => {
			confirmModal.current?.show('Delete event', 'Delete event?', 'Delete', () => {
				socketEmitPromise(socket, 'controls:event:remove', [controlId, eventId]).catch((e) => {
					console.error(`Failed to delete event: ${e}`)
				})
			})
		},
		[socket, controlId]
	)

	const doDuplicate = useCallback(
		(eventId: string) => {
			socketEmitPromise(socket, 'controls:event:duplicate', [controlId, eventId]).catch((e) => {
				console.error(`Failed to duplicate feeeventdback: ${e}`)
			})
		},
		[socket, controlId]
	)

	const addEvent = useCallback(
		(eventType: DropdownChoiceId) => {
			socketEmitPromise(socket, 'controls:event:add', [controlId, eventType]).catch((e) => {
				console.error('Failed to add trigger event', e)
			})
		},
		[socket, controlId]
	)

	const moveCard = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			socketEmitPromise(socket, 'controls:event:reorder', [controlId, dragIndex, hoverIndex]).catch((e) => {
				console.error(`Move failed: ${e}`)
			})
		},
		[socket, controlId]
	)

	const emitEnabled = useCallback(
		(eventId: string, enabled: boolean) => {
			socketEmitPromise(socket, 'controls:event:enabled', [controlId, eventId, enabled]).catch((e) => {
				console.error('Failed to enable/disable event', e)
			})
		},
		[socket, controlId]
	)

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
								setValue={setValue}
								doDelete={doDelete}
								doDuplicate={doDuplicate}
								doEnabled={emitEnabled}
								dragId={`events_${controlId}`}
								moveCard={moveCard}
								setCollapsed={setPanelCollapsed}
								isCollapsed={isPanelCollapsed(a.id)}
							/>
						</MyErrorBoundary>
					))}
				</tbody>
			</table>

			<div className="add-dropdown-wrapper">
				<AddEventDropdown onSelect={addEvent} />
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
	moveCard: (dragIndex: number, hoverIndex: number) => void
	setValue: (eventId: string, key: string, value: any) => void
	doDelete: (eventId: string) => void
	doDuplicate: (eventId: string) => void
	doEnabled: (eventId: string, value: boolean) => void
	isCollapsed: boolean
	setCollapsed: (eventId: string, collapsed: boolean) => void
}

function EventsTableRow({
	event,
	index,
	dragId,
	moveCard,
	setValue,
	doDelete,
	doDuplicate,
	doEnabled,
	isCollapsed,
	setCollapsed,
}: EventsTableRowProps): JSX.Element | null {
	const innerDelete = useCallback(() => doDelete(event.id), [event.id, doDelete])
	const innerDuplicate = useCallback(() => doDuplicate(event.id), [event.id, doDuplicate])

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
			moveCard(dragIndex, hoverIndex)

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

	const doCollapse = useCallback(() => {
		setCollapsed(event.id, true)
	}, [setCollapsed, event.id])
	const doExpand = useCallback(() => {
		setCollapsed(event.id, false)
	}, [setCollapsed, event.id])

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
					setValue={setValue}
					innerDelete={innerDelete}
					innerDuplicate={innerDuplicate}
					isCollapsed={isCollapsed}
					doCollapse={doCollapse}
					doExpand={doExpand}
					doEnabled={doEnabled}
				/>
			</td>
		</tr>
	)
}

interface EventEditorProps {
	event: EventInstance
	setValue: (eventId: string, key: string, value: any) => void
	innerDelete: () => void
	innerDuplicate: () => void
	isCollapsed: boolean
	doCollapse: () => void
	doExpand: () => void
	doEnabled: (eventId: string, value: boolean) => void
}

function EventEditor({
	event,
	setValue,
	innerDelete,
	innerDuplicate,
	isCollapsed,
	doCollapse,
	doExpand,
	doEnabled,
}: EventEditorProps) {
	const EventDefinitions = useContext(EventDefinitionsContext)

	const eventSpec = EventDefinitions[event.type]

	const [eventOptions, optionVisibility] = useOptionsAndIsVisible(eventSpec, event)

	const innerSetEnabled = useCallback(
		(e: FormEvent<HTMLInputElement>) => doEnabled(event.id, e.currentTarget.checked),
		[doEnabled, event.id]
	)

	const name = eventSpec ? eventSpec.name : `${event.type} (undefined)`

	return (
		<>
			<div className="editor-grid-header editor-grid-events">
				<div className="cell-name">{name}</div>

				<div className="cell-controls">
					<CButtonGroup>
						{isCollapsed ? (
							<CButton size="sm" onClick={doExpand} title="Expand event view">
								<FontAwesomeIcon icon={faExpandArrowsAlt} />
							</CButton>
						) : (
							<CButton size="sm" onClick={doCollapse} title="Collapse event view">
								<FontAwesomeIcon icon={faCompressArrowsAlt} />
							</CButton>
						)}
						<CButton size="sm" onClick={innerDuplicate} title="Duplicate event">
							<FontAwesomeIcon icon={faCopy} />
						</CButton>
						<CButton size="sm" onClick={innerDelete} title="Remove event">
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
						{!!doEnabled && (
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
					<div className="cell-description">{eventSpec?.description || ''}</div>

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
										actionId={event.id}
										value={(event.options || {})[opt.id]}
										setValue={setValue}
										visibility={optionVisibility[opt.id]}
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

const noOptionsMessage = ({}) => {
	return 'No events found'
}

interface AddEventDropdownProps {
	onSelect: (value: DropdownChoiceId) => void
}

const AddEventDropdown = memo(function AddEventDropdown({ onSelect }: AddEventDropdownProps) {
	const menuPortal = useContext(MenuPortalContext)
	const EventDefinitions = useContext(EventDefinitionsContext)

	const options = useMemo(() => {
		const options: DropdownChoice[] = []
		for (const [eventId, event] of Object.entries(EventDefinitions || {})) {
			if (!event) continue
			options.push({
				id: eventId,
				label: event.name,
			})
		}

		// Sort by name
		options.sort((a, b) => a.label.localeCompare(b.label))

		return options
	}, [EventDefinitions])

	const innerChange = useCallback(
		(e: DropdownChoice | null) => {
			if (e?.id) {
				onSelect(e.id)
			}
		},
		[onSelect]
	)

	return (
		<Select
			menuShouldBlockScroll={!!menuPortal} // The dropdown doesn't follow scroll when in a modal
			menuPortalTarget={menuPortal || document.body}
			menuPosition={'fixed'}
			classNamePrefix="select-control"
			menuPlacement="auto"
			isClearable={false}
			isSearchable={true}
			isMulti={false}
			options={options}
			placeholder="+ Add event"
			value={null}
			onChange={innerChange}
			noOptionsMessage={noOptionsMessage}
		/>
	)
})
