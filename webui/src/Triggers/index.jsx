import React, { memo, useCallback, useContext, useEffect, useState, useMemo, useRef } from 'react'
import {
	CButton,
	CButtonGroup,
	CCol,
	CNav,
	CNavItem,
	CNavLink,
	CRow,
	CTabContent,
	CTabPane,
	CTabs,
} from '@coreui/react'
import { MyErrorBoundary, SocketContext, socketEmitPromise, TriggersContext } from '../util'
import dayjs from 'dayjs'
import sanitizeHtml from 'sanitize-html'
import CSwitch from '../CSwitch'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faCalculator, faSort } from '@fortawesome/free-solid-svg-icons'
import { useDrag, useDrop } from 'react-dnd'
import { nanoid } from 'nanoid'
import { EditTriggerPanel } from './EditPanel'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'

export const Triggers = memo(function Triggers() {
	const socket = useContext(SocketContext)

	const triggersList = useContext(TriggersContext)

	const [editItemId, setEditItemId] = useState(null)
	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState('placeholder')

	// Ensure the selected trigger is valid
	useEffect(() => {
		setEditItemId((currentId) => {
			if (triggersList[currentId]) {
				return currentId
			} else {
				return null
			}
		})
	}, [triggersList])

	const doChangeTab = useCallback((newTab) => {
		setActiveTab((oldTab) => {
			const preserveButtonsTab = newTab === 'variables' && oldTab === 'edit'
			if (newTab !== 'edit' && oldTab !== newTab && !preserveButtonsTab) {
				setEditItemId(null)
				setTabResetToken(nanoid())
			}
			return newTab
		})
	}, [])
	const doEditItem = useCallback((controlId) => {
		setEditItemId(controlId)
		setActiveTab('edit')
	}, [])

	const doAddNew = useCallback(() => {
		socketEmitPromise(socket, 'triggers:create', [])
			.then((controlId) => {
				console.log('created trigger', controlId)
				doEditItem(controlId)
			})
			.catch((e) => {
				console.error('failed to create trigger', e)
			})
	}, [socket, doEditItem])

	return (
		<CRow className="triggers-page split-panels">
			<CCol xs={12} xl={6} className="primary-panel">
				<h4>Triggers and schedules</h4>
				<p>This allows you to run actions based on Companion, feedback or time events.</p>

				<CButtonGroup style={{ marginBottom: '0.3em' }}>
					<CButton color="primary" onClick={doAddNew}>
						<FontAwesomeIcon icon={faAdd} /> Add Trigger
					</CButton>
				</CButtonGroup>

				<TriggersTable triggersList={triggersList} editItem={doEditItem} />

				{/* <CButton
				color="light"
				style={{
					marginLeft: 10,
				}}
				href={`/int/export/triggers/all`}
				target="_new"
			>
				<FontAwesomeIcon icon={faFileExport} /> Export all
			</CButton> */}
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-inner">
					<CTabs activeTab={activeTab} onActiveTabChange={doChangeTab}>
						<CNav variant="tabs">
							<CNavItem>
								<CNavLink data-tab="placeholder">Select a trigger</CNavLink>
							</CNavItem>
							<CNavItem hidden={!editItemId}>
								<CNavLink data-tab="edit">
									<FontAwesomeIcon icon={faCalculator} /> Edit Trigger
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent fade={false}>
							<CTabPane data-tab="placeholder">
								<p>Select a trigger...</p>
							</CTabPane>
							<CTabPane data-tab="edit">
								<MyErrorBoundary>
									{editItemId ? <EditTriggerPanel key={`${editItemId}.${tabResetToken}`} controlId={editItemId} /> : ''}
								</MyErrorBoundary>
							</CTabPane>
						</CTabContent>
					</CTabs>
				</div>
			</CCol>
		</CRow>
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
					<th>&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{triggersList && Object.keys(triggersList).length > 0 ? (
					Object.entries(triggersList)
						.sort((a, b) => a[1].sortOrder - b[1].sortOrder)
						.map(([controlId, item]) => (
							<TriggersTableRow
								key={controlId}
								controlId={controlId}
								item={item}
								editItem={editItem}
								moveTrigger={moveTrigger}
							/>
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
function TriggersTableRow({ controlId, item, editItem, moveTrigger }) {
	const socket = useContext(SocketContext)

	const confirmRef = useRef(null)

	const doEnableDisable = useCallback(() => {
		socketEmitPromise(socket, 'controls:set-options-field', [controlId, 'enabled', !item.enabled]).catch((e) => {
			console.error('failed to toggle trigger state', e)
		})
	}, [socket, controlId, item.enabled])
	const doDelete = useCallback(() => {
		confirmRef.current.show('Delete trigger', 'Are you sure you wish to delete this trigger?', 'Delete', () => {
			socketEmitPromise(socket, 'triggers:delete', [controlId]).catch((e) => {
				console.error('Failed to delete', e)
			})
		})
	}, [socket, controlId])
	const doEdit = useCallback(() => editItem(controlId), [editItem, controlId])
	const doClone = useCallback(() => {
		socketEmitPromise(socket, 'triggers:clone', [controlId])
			.then((newControlId) => {
				console.log('cloned to control', newControlId)
			})
			.catch((e) => {
				console.error('Failed to clone', e)
			})
	}, [socket, controlId])

	const descriptionHtml = useMemo(
		() => ({
			__html: sanitizeHtml(item.description, {
				allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
				disallowedTagsMode: 'escape',
			}),
		}),
		[item.description]
	)

	const ref = useRef(null)
	const [, drop] = useDrop({
		accept: 'trigger',
		hover(hoverItem, monitor) {
			if (!ref.current) {
				return
			}
			// Don't replace items with themselves
			if (hoverItem.id === controlId) {
				return
			}

			// Time to actually perform the action
			moveTrigger(hoverItem.id, controlId)
		},
	})
	const [{ isDragging }, drag, preview] = useDrag({
		type: 'trigger',
		item: {
			id: controlId,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	return (
		<tr ref={ref} className={isDragging ? 'instancelist-dragging' : ''}>
			<GenericConfirmModal ref={confirmRef} />

			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>{item.name}</td>
			<td>
				<span dangerouslySetInnerHTML={descriptionHtml} />
				<br />
				{item.lastExecuted ? <small>Last run: {dayjs(item.lastExecuted).format(tableDateFormat)}</small> : ''}
			</td>
			<td className="action-buttons">
				<CSwitch
					color="info"
					checked={item.enabled}
					onChange={doEnableDisable}
					title={item.enabled ? 'Disable trigger' : 'Enable trigger'}
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
					{/* <CButton size="sm" color="light" href={`/int/export/trigger/single/${controlId}`} target="_new">
					export
				</CButton> */}
				</CButtonGroup>
			</td>
		</tr>
	)
}
