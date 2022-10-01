import React, { memo, useCallback, useContext, useEffect, useState, useMemo } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { SocketContext, TriggersContext } from '../util'
import dayjs from 'dayjs'
import { TriggerEditModal } from './EditModal'
import sanitizeHtml from 'sanitize-html'
import CSwitch from '../CSwitch'

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
	return (
		<table className="table table-responsive-sm ">
			<thead>
				<tr>
					<th>Name</th>
					<th>Trigger</th>
					<th>&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{triggersList && Object.keys(triggersList).length > 0 ? (
					Object.values(triggersList).map((item) => <TriggersTableRow key={item.id} item={item} editItem={editItem} />)
				) : (
					<tr>
						<td colSpan="4">There currently are no triggers or scheduled tasks.</td>
					</tr>
				)}
			</tbody>
		</table>
	)
}
function TriggersTableRow({ item, editItem }) {
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

	return (
		<tr>
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
