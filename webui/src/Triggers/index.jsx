import React, { memo, useCallback, useContext, useEffect, useState, useMemo, useRef } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { SocketContext, socketEmitPromise, TriggersContext } from '../util'
import dayjs from 'dayjs'
import { TriggerEditModal } from './EditModal'
import sanitizeHtml from 'sanitize-html'
import CSwitch from '../CSwitch'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSort } from '@fortawesome/free-solid-svg-icons'
import { useDrag, useDrop } from 'react-dnd'

export const Triggers = memo(function Triggers() {
	const socket = useContext(SocketContext)

	const triggersList = useContext(TriggersContext)

	const [plugins, setPlugins] = useState(null)
	const [editItem, setEditItem] = useState([false, null])

	const doEditItem = useCallback((itemId) => setEditItem([true, itemId]), [])
	const doAddNew = useCallback(() => setEditItem([true, null]), [])
	const doCloseModal = useCallback(() => setEditItem([false, null]), [])

	const doSave = useCallback(
		(newConfig) => {
			console.log('save item', newConfig)
			socket.emit('schedule_save_item', newConfig)
		},
		[socket]
	)

	// on mount, load the plugins
	useEffect(() => {
		socket.emit('schedule_plugins', (newPlugins) => {
			setPlugins(newPlugins)
		})
	}, [socket])

	return (
		<div>
			<h4>Triggers and schedules</h4>
			<p>This allows you to run actions based on Companion, feedback or time events.</p>

			{editItem[0] ? (
				<TriggerEditModal
					item={editItem[1] !== null ? triggersList[editItem[1]] : undefined}
					doClose={doCloseModal}
					plugins={plugins}
					doSave={doSave}
				/>
			) : (
				''
			)}

			<TriggersTable triggersList={triggersList} editItem={doEditItem} />

			<CButton color="primary" onClick={doAddNew}>
				Add New Trigger
			</CButton>

			{/* <CButton
				color="light"
				style={{
					marginLeft: 10,
				}}
				href={`/int/trigger_export_all`}
				target="_new"
			>
				<FontAwesomeIcon icon={faFileExport} /> Export all
			</CButton> */}
		</div>
	)
})

const tableDateFormat = 'MM/DD HH:mm:ss'
function TriggersTable({ triggersList, editItem }) {
	const socket = useContext(SocketContext)

	const triggersRef = useRef(triggersList)
	useEffect(() => {
		triggersRef.current = triggersList
	}, [triggersList])

	const moveTrigger = useCallback(
		(itemId, targetId) => {
			itemId = itemId + ''
			targetId = targetId + ''

			if (triggersRef.current) {
				const rawIds = Object.entries(triggersRef.current)
					.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
					.map(([id]) => id)

				const itemIndex = rawIds.indexOf(itemId)
				const targetIndex = rawIds.indexOf(targetId)
				if (itemIndex === -1 || targetIndex === -1) return

				const newIds = rawIds.filter((id) => id !== itemId)
				newIds.splice(targetIndex, 0, itemId)

				socketEmitPromise(socket, 'triggers:set-order', [newIds]).catch((e) => {
					console.error('Reorder failed', e)
				})
			}
		},
		[socket]
	)

	return (
		<table className="table table-responsive-sm ">
			<thead>
				<tr>
					<th>&nbsp;</th>
					<th>Name</th>
					<th>Trigger</th>
					<th>&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{triggersList && Object.keys(triggersList).length > 0 ? (
					Object.values(triggersList)
						.sort((a, b) => a.sortOrder - b.sortOrder)
						.map((item) => <TriggersTableRow key={item.id} item={item} editItem={editItem} moveTrigger={moveTrigger} />)
				) : (
					<tr>
						<td colSpan="4">There currently are no triggers or scheduled tasks.</td>
					</tr>
				)}
			</tbody>
		</table>
	)
}
function TriggersTableRow({ item, editItem, moveTrigger }) {
	const socket = useContext(SocketContext)

	const doEnableDisable = useCallback(() => {
		socket.emit('schedule_update_item', item.id, { disabled: !item.disabled })
	}, [socket, item.id, item.disabled])
	const doDelete = useCallback(() => {
		socket.emit('schedule_update_item', item.id, { deleted: true })
	}, [socket, item.id])
	const doEdit = useCallback(() => {
		editItem(item.id)
	}, [editItem, item.id])
	const doClone = useCallback(() => {
		socket.emit('schedule_clone_item', item.id)
	}, [socket, item.id])

	const descriptionHtml = useMemo(
		() => ({
			__html: sanitizeHtml(item.config_desc, {
				allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
				disallowedTagsMode: 'escape',
			}),
		}),
		[item.config_desc]
	)

	const ref = useRef(null)
	const [, drop] = useDrop({
		accept: 'trigger',
		hover(hoverItem, monitor) {
			if (!ref.current) {
				return
			}
			// Don't replace items with themselves
			if (hoverItem.id === item.id) {
				return
			}

			// Time to actually perform the action
			moveTrigger(hoverItem.id, item.id)
		},
	})
	const [{ isDragging }, drag, preview] = useDrag({
		type: 'trigger',
		item: {
			id: item.id,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	return (
		<tr ref={ref} className={isDragging ? 'instancelist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>{item.title}</td>
			<td>
				<span dangerouslySetInnerHTML={descriptionHtml} />
				<br />
				{item.last_run ? <small>Last run: {dayjs(item.last_run).format(tableDateFormat)}</small> : ''}
			</td>
			<td className="action-buttons">
				<CSwitch
					color="info"
					checked={!item.disabled}
					onChange={doEnableDisable}
					title={!item.disabled ? 'Disable trigger' : 'Enable trigger'}
				/>
				&nbsp;
				<CButtonGroup>
					<CButton size="sm" color="info" onClick={doEdit}>
						edit
					</CButton>
					<CButton size="sm" color="warning" onClick={doClone}>
						clone
					</CButton>
					<CButton size="sm" color="danger" onClick={doDelete}>
						delete
					</CButton>
					{/* <CButton size="sm" color="light" href={`/int/trigger_export/${item.id}`} target="_new">
					export
				</CButton> */}
				</CButtonGroup>
			</td>
		</tr>
	)
}
