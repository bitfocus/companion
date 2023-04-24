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
import {
	faAdd,
	faCalculator,
	faClone,
	faDownload,
	faFileExport,
	faSort,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { useDrag, useDrop } from 'react-dnd'
import { nanoid } from 'nanoid'
import { EditTriggerPanel } from './EditPanel'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { ParseControlId } from '@companion/shared/ControlId'
import { ConfirmExportModal } from '../Components/ConfirmExportModal'

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

	const exportModalRef = useRef(null)
	const showExportModal = useCallback(() => {
		exportModalRef.current.show(`/int/export/triggers/all`)
	}, [])

	return (
		<CRow className="triggers-page split-panels">
			<ConfirmExportModal ref={exportModalRef} title="Export Triggers" />

			<CCol xs={12} xl={6} className="primary-panel">
				<h4>Triggers and schedules</h4>
				<p>This allows you to run actions based on Companion, feedback or time events.</p>

				<CButtonGroup style={{ marginBottom: '0.3em' }}>
					<CButton color="primary" onClick={doAddNew}>
						<FontAwesomeIcon icon={faAdd} /> Add Trigger
					</CButton>
				</CButtonGroup>

				<TriggersTable triggersList={triggersList} editItem={doEditItem} />

				<CButton
					color="light"
					style={{
						marginTop: 10,
					}}
					onClick={showExportModal}
				>
					<FontAwesomeIcon icon={faFileExport} /> Export all
				</CButton>
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-inner">
					<CTabs activeTab={activeTab} onActiveTabChange={doChangeTab}>
						<CNav variant="tabs">
							{!editItemId && (
								<CNavItem>
									<CNavLink data-tab="placeholder">Select a trigger</CNavLink>
								</CNavItem>
							)}
							<CNavItem hidden={!editItemId}>
								<CNavLink data-tab="edit">
									<FontAwesomeIcon icon={faCalculator} /> Edit Trigger
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent fade={false}>
							{!editItemId && (
								<CTabPane data-tab="placeholder">
									<p>Select a trigger...</p>
								</CTabPane>
							)}
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
		<table className="table-tight table-responsive-sm ">
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
						<td colSpan="4" className="currentlyNone">
							There currently are no triggers or scheduled tasks.
						</td>
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

	const parsedId = ParseControlId(controlId)
	const exportId = parsedId?.type === 'trigger' ? parsedId?.trigger : undefined

	return (
		<tr ref={ref} className={isDragging ? 'instancelist-dragging' : 'instancelist-notdragging'}>
			<td ref={drag} className="td-reorder" style={{ maxWidth: 20 }}>
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td
				onClick={(e) => {
					doEdit()
				}}
				className="hand"
			>
				<b>{item.name}</b>

				{/* TODO: For some reason, the modal component leaves a big inline
				footprint within tables when not active. This is probably the best 
				place to hide it while it does that.. (until someone figures it out) */}
				<br />
				<GenericConfirmModal ref={confirmRef} />
				{/* end hax */}
			</td>
			<td
				onClick={(e) => {
					doEdit()
				}}
				className="hand"
			>
				<span dangerouslySetInnerHTML={descriptionHtml} />
				<br />
				{item.lastExecuted ? <small>Last run: {dayjs(item.lastExecuted).format(tableDateFormat)}</small> : ''}
			</td>
			<td className="action-buttons">
				<div style={{ display: 'flex' }}>
					<div>
						<CButtonGroup>
							<CButton size="md" color="white" onClick={doClone} title="Clone" style={{ padding: 3, paddingRight: 6 }}>
								<FontAwesomeIcon icon={faClone} />
							</CButton>
							<CButton size="md" color="gray" onClick={doDelete} title="Delete" style={{ padding: 3, paddingRight: 6 }}>
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
							<CButton
								style={{ padding: 3, paddingRight: 6 }}
								color="white"
								href={`/int/export/triggers/single/${exportId}`}
								target="_new"
								disabled={!exportId}
								title="Export"
							>
								<FontAwesomeIcon icon={faDownload} />
							</CButton>
						</CButtonGroup>
					</div>
					<div style={{ marginTop: 0, marginLeft: 4 }}>
						<CSwitch
							color="success"
							checked={item.enabled}
							onChange={doEnableDisable}
							title={item.enabled ? 'Disable trigger' : 'Enable trigger'}
						/>
					</div>
				</div>
			</td>
		</tr>
	)
}
