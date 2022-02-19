import React, { memo, useCallback, useContext, useEffect, useState } from 'react'
import { CButton } from '@coreui/react'
import { StaticContext } from '../util'
import dayjs from 'dayjs'
import { TriggerEditModal } from './EditModal'

export const Triggers = memo(function Triggers() {
	const context = useContext(StaticContext)

	const [plugins, setPlugins] = useState(null)
	const [triggersList, setTriggersList] = useState(null)
	const [editItem, setEditItem] = useState([false, null])

	const loadTriggersList = useCallback((list) => {
		setTriggersList(list)
	}, [])

	const replaceItem = useCallback((itemId, item) => {
		setTriggersList((list) => {
			const newList = [...list]
			const index = newList.findIndex((i) => i.id === itemId)
			if (index !== -1) {
				if (item) {
					newList[index] = item
				} else {
					newList.splice(index, 1)
				}
			} else if (item) {
				newList.push(item)
			}
			return newList
		})
	}, [])

	const doEditItem = useCallback((itemId) => setEditItem([true, itemId]), [])
	const doAddNew = useCallback(() => setEditItem([true, null]), [])
	const doCloseModal = useCallback(() => setEditItem([false, null]), [])

	const doSave = useCallback(
		(newConfig) => {
			console.log('save item', newConfig)
			context.socket.emit('schedule_save_item', newConfig, (clean) => {
				replaceItem(clean.id, clean)
			})
		},
		[context.socket, replaceItem]
	)

	// on mount, load the plugins
	useEffect(() => {
		context.socket.emit('schedule_plugins', (newPlugins) => {
			setPlugins(newPlugins)
		})
		context.socket.emit('schedule_get', loadTriggersList)
		context.socket.on('schedule_refresh', loadTriggersList)

		return () => {
			context.socket.off('schedule_refresh', loadTriggersList)
		}
	}, [context.socket, loadTriggersList])

	return (
		<div>
			<h4>Triggers and schedules</h4>
			<p>This allows you to run actions based on instance or time events.</p>

			{editItem[0] ? (
				<TriggerEditModal
					item={editItem[1] !== null ? triggersList.find((i) => i.id === editItem[1]) : undefined}
					doClose={doCloseModal}
					plugins={plugins}
					doSave={doSave}
				/>
			) : (
				''
			)}

			<TriggersTable triggersList={triggersList} replaceItem={replaceItem} editItem={doEditItem} />

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
function TriggersTable({ triggersList, replaceItem, editItem }) {
	return (
		<table className="table table-responsive-sm">
			<thead>
				<tr>
					<th>Name</th>
					<th>Trigger</th>
					<th>&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{triggersList && triggersList.length > 0 ? (
					triggersList.map((item) => (
						<TriggersTableRow key={item.id} item={item} replaceItem={replaceItem} editItem={editItem} />
					))
				) : (
					<tr>
						<td colSpan="4">There currently are no triggers or scheduled tasks.</td>
					</tr>
				)}
			</tbody>
		</table>
	)
}
function TriggersTableRow({ item, replaceItem, editItem }) {
	const context = useContext(StaticContext)

	const doEnableDisable = useCallback(() => {
		context.socket.emit('schedule_update_item', item.id, { disabled: !item.disabled }, (clean) => {
			console.log('completed disable', clean)
			replaceItem(clean.id, clean)
		})
	}, [context.socket, replaceItem, item.id, item.disabled])
	const doDelete = useCallback(() => {
		context.socket.emit('schedule_update_item', item.id, { deleted: true }, () => {
			console.log('completed delete', item.id)
			replaceItem(item.id, null)
		})
	}, [context.socket, replaceItem, item.id])
	const doEdit = useCallback(() => {
		editItem(item.id)
	}, [editItem, item.id])
	const doClone = useCallback(() => {
		context.socket.emit('schedule_clone_item', item.id, (newItem) => {
			console.log('completed clone', item.id, newItem.id)
			replaceItem(newItem.id, newItem)
		})
	}, [context.socket, replaceItem, item.id])

	return (
		<tr>
			<td>{item.title}</td>
			<td>
				{/* TODO - can we remove the dangerous html markup here? */}
				<div dangerouslySetInnerHTML={{ __html: item.config_desc }} />
				<br />
				{item.last_run ? <small>Last run: {dayjs(item.last_run).format(tableDateFormat)}</small> : ''}
			</td>
			<td className="action-buttons">
				<CButton size="sm" color="ghost-danger" onClick={doDelete}>
					delete
				</CButton>
				{item.disabled ? (
					<CButton size="sm" color="ghost-success" onClick={doEnableDisable}>
						enable
					</CButton>
				) : (
					<CButton size="sm" color="ghost-warning" onClick={doEnableDisable}>
						disable
					</CButton>
				)}
				<CButton size="sm" color="primary" onClick={doEdit}>
					edit
				</CButton>
				<CButton size="sm" color="warning" onClick={doClone}>
					clone
				</CButton>
				{/* <CButton size="sm" color="light" href={`/int/trigger_export/${item.id}`} target="_new">
					export
				</CButton> */}
			</td>
		</tr>
	)
}
