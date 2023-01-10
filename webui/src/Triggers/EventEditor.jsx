import { CButton, CForm, CButtonGroup, CSwitch } from '@coreui/react'
import { faSort, faTrash, faCompressArrowsAlt, faExpandArrowsAlt, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MyErrorBoundary, socketEmitPromise, sandbox, SocketContext, EventDefinitionsContext } from '../util'
import Select from 'react-select'
import { OptionsInputField } from '../Controls/OptionsInputField'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'
import { MenuPortalContext } from '../Components/DropdownInputField'

export function TriggerEventEditor({ controlId, events, heading }) {
	const socket = useContext(SocketContext)

	const confirmModal = useRef()

	const eventsRef = useRef()
	eventsRef.current = events

	const setValue = useCallback(
		(eventId, key, val) => {
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
		(eventId) => {
			confirmModal.current.show('Delete event', 'Delete event?', 'Delete', () => {
				socketEmitPromise(socket, 'controls:event:remove', [controlId, eventId]).catch((e) => {
					console.error(`Failed to delete event: ${e}`)
				})
			})
		},
		[socket, controlId]
	)

	const doDuplicate = useCallback(
		(eventId) => {
			socketEmitPromise(socket, 'controls:event:duplicate', [controlId, eventId]).catch((e) => {
				console.error(`Failed to duplicate feeeventdback: ${e}`)
			})
		},
		[socket, controlId]
	)

	const addEvent = useCallback(
		(eventType) => {
			socketEmitPromise(socket, 'controls:event:add', [controlId, eventType]).catch((e) => {
				console.error('Failed to add bank event', e)
			})
		},
		[socket, controlId]
	)

	const moveCard = useCallback(
		(dragIndex, hoverIndex) => {
			socketEmitPromise(socket, 'controls:event:reorder', [controlId, dragIndex, hoverIndex]).catch((e) => {
				console.error(`Move failed: ${e}`)
			})
		},
		[socket, controlId]
	)

	const emitEnabled = useCallback(
		(eventId, enabled) => {
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
				<CButtonGroup className="right">
					<CButtonGroup>
						<CButton color="info" size="sm" onClick={setAllExpanded} title="Expand all events" disabled={!canExpandAll}>
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>{' '}
						<CButton
							color="info"
							size="sm"
							onClick={setAllCollapsed}
							title="Collapse all events"
							disabled={!canCollapseAll}
						>
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					</CButtonGroup>
				</CButtonGroup>
			</h4>

			<table className="table feedback-table">
				<tbody>
					{events.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<EventsTableRow
								key={a?.id ?? i}
								index={i}
								controlId={controlId}
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

function EventsTableRow({
	event,
	controlId,
	index,
	dragId,
	moveCard,
	setValue,
	doDelete,
	doDuplicate,
	doEnabled,
	isCollapsed,
	setCollapsed,
}) {
	const innerDelete = useCallback(() => doDelete(event.id), [event.id, doDelete])
	const innerDuplicate = useCallback(() => doDuplicate(event.id), [event.id, doDuplicate])

	const ref = useRef(null)
	const [, drop] = useDrop({
		accept: dragId,
		hover(item, monitor) {
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
	const [{ isDragging }, drag, preview] = useDrag({
		type: dragId,
		item: {
			actionId: event.id,
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
		return ''
	}

	return (
		<tr ref={ref} className={isDragging ? 'feedbacklist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				<EventEditor
					controlId={controlId}
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

function EventEditor({
	event,
	controlId,
	setValue,
	innerDelete,
	innerDuplicate,
	isCollapsed,
	doCollapse,
	doExpand,
	doEnabled,
}) {
	const EventDefinitions = useContext(EventDefinitionsContext)

	const eventSpec = EventDefinitions[event.type]
	const options = eventSpec?.options ?? []

	const [optionVisibility, setOptionVisibility] = useState({})

	const innerSetEnabled = useCallback((e) => doEnabled(event.id, e.target.checked), [doEnabled, event.id])

	useEffect(() => {
		const options = eventSpec?.options ?? []

		for (const option of options) {
			if (typeof option.isVisibleFn === 'string') {
				option.isVisible = sandbox(option.isVisibleFn)
			}
		}
	}, [eventSpec])

	useEffect(() => {
		const visibility = {}
		const options = eventSpec?.options ?? []

		if (options === null || event === null) {
			return
		}

		for (const option of options) {
			if (typeof option.isVisible === 'function') {
				visibility[option.id] = option.isVisible(event.options)
			}
		}

		setOptionVisibility(visibility)

		return () => {
			setOptionVisibility({})
		}
	}, [eventSpec, event])

	let name = ''
	if (eventSpec) {
		name = eventSpec.name
	} else {
		name = `${event.type} (undefined)`
	}

	return (
		<div className="editor-grid">
			<div className="cell-name">{name}</div>

			<div className="cell-controls">
				<CButtonGroup>
					{doEnabled && (
						<CSwitch
							color="info"
							checked={event.enabled}
							title={event.enabled ? 'Disable event' : 'Enable event'}
							onChange={innerSetEnabled}
						/>
					)}
					&nbsp;
					{isCollapsed ? (
						<CButton color="info" size="sm" onClick={doExpand} title="Expand event view">
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>
					) : (
						<CButton color="info" size="sm" onClick={doCollapse} title="Collapse event view">
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					)}
					<CButton color="warning" size="sm" onClick={innerDuplicate} title="Duplicate event">
						<FontAwesomeIcon icon={faCopy} />
					</CButton>
					<CButton color="danger" size="sm" onClick={innerDelete} title="Remove event">
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</CButtonGroup>
			</div>

			{!isCollapsed ? (
				<>
					<div className="cell-description">{eventSpec?.description || ''}</div>

					<div className="cell-option">
						<CForm>
							{options.map((opt, i) => (
								<MyErrorBoundary key={i}>
									<OptionsInputField
										key={i}
										isOnControl={false}
										instanceId={'internal'}
										option={opt}
										actionId={event.id}
										value={(event.options || {})[opt.id]}
										setValue={setValue}
										visibility={optionVisibility[opt.id]}
									/>
								</MyErrorBoundary>
							))}
							{options.length === 0 ? 'Nothing to configure' : ''}
						</CForm>
					</div>
				</>
			) : (
				''
			)}
		</div>
	)
}

const noOptionsMessage = ({ inputValue }) => {
	return 'No events found'
}

function AddEventDropdown({ onSelect }) {
	const menuPortal = useContext(MenuPortalContext)
	const EventDefinitions = useContext(EventDefinitionsContext)

	const options = useMemo(() => {
		const options = []
		for (const [eventId, event] of Object.entries(EventDefinitions || {})) {
			options.push({
				value: eventId,
				label: event.name,
			})
		}

		// Sort by name
		options.sort((a, b) => a.label.localeCompare(b.label))

		return options
	}, [EventDefinitions])

	const innerChange = useCallback(
		(e) => {
			if (e.value) {
				onSelect(e.value)
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
}
