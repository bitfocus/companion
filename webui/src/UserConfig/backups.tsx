import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CFormSwitch, CRow } from '@coreui/react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import dayjs from 'dayjs'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import type { BackupRulesConfig } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../Components/NonIdealState.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { backupTypes } from './BackupConstants.js'
import { checkDragState, DragState } from '~/util.js'

export const SettingsBackupsPage = observer(function UserConfig() {
	const { socket } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/settings/backups' })

	const doEditRule = useCallback(
		(ruleId: string) => {
			void navigate({ to: `/settings/backups/${ruleId}` })
		},
		[navigate]
	)

	const doAddNew = useCallback(() => {
		// Create the new rule using the dedicated endpoint
		socket
			.emitPromise('backup-rules:create', ['New Backup Rule'])
			.then((ruleId) => {
				// Navigate to the new rule for editing
				doEditRule(ruleId)
			})
			.catch((err) => {
				console.error('Error creating backup rule:', err)
			})
	}, [socket, doEditRule])

	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<div className="d-flex justify-content-between">
					<div>
						<h4>Settings - Backups</h4>
						<p>Scheduled backups of your Companion configuration. Settings apply instantaneously!</p>
					</div>
				</div>

				<div className="mb-2">
					<CButtonGroup>
						<CButton color="primary" onClick={doAddNew} size="sm">
							<FontAwesomeIcon icon={faAdd} /> Add Backup Rule
						</CButton>
					</CButtonGroup>
				</div>

				<BackupsTable editRule={doEditRule} />
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-inner">
					<Outlet />
				</div>
			</CCol>
		</CRow>
	)
})

interface BackupsTableProps {
	editRule: (ruleId: string) => void
}

const BackupsTable = observer(function BackupsTable({ editRule }: BackupsTableProps) {
	const { userConfig, socket } = useContext(RootAppStoreContext)

	const backupRules = userConfig.properties?.backups || []

	const moveRule = useCallback(
		(itemId: string, targetId: string) => {
			socket.emitPromise('backup-rules:reorder', [itemId, targetId]).catch((err) => {
				console.error('Error reordering backup rules:', err)
			})
		},
		[socket]
	)

	return (
		<table className="table-tight table-responsive-sm" style={{ marginBottom: 10 }}>
			<tbody>
				{backupRules.length > 0 ? (
					backupRules.map((rule) => (
						<BackupsTableRow key={rule.id} rule={rule} editRule={editRule} moveRule={moveRule} />
					))
				) : (
					<tr>
						<td colSpan={4} className="currentlyNone">
							<NonIdealState icon={faAdd} text="No backup rules configured. Add one to get started!" />
						</td>
					</tr>
				)}
			</tbody>
		</table>
	)
})

interface BackupsTableRowDragData {
	id: string

	dragState: DragState | null
}
interface BackupsTableRowDragStatus {
	isDragging: boolean
}

interface BackupsTableRowProps {
	rule: BackupRulesConfig
	editRule: (ruleId: string) => void
	moveRule: (itemId: string, targetId: string) => void
}

function BackupsTableRow({ rule, editRule, moveRule }: BackupsTableRowProps) {
	const { socket } = useContext(RootAppStoreContext)
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const doEnableDisable = useCallback(() => {
		// Toggle the enabled state using the dedicated endpoint
		socket.emitPromise('backup-rules:update-field', [rule.id, 'enabled', !rule.enabled]).catch((err) => {
			console.error('Error updating backup rule enabled state:', err)
		})
	}, [socket, rule.id, rule.enabled])

	const doDelete = useCallback(() => {
		confirmRef.current?.show(
			'Delete backup rule',
			'Are you sure you wish to delete this backup rule?',
			'Delete',
			() => {
				socket.emitPromise('backup-rules:delete', [rule.id]).catch((err) => {
					console.error('Error deleting backup rule:', err)
				})
			}
		)
	}, [socket, rule.id])

	const doEdit = useCallback(() => editRule(rule.id), [editRule, rule.id])

	const ref = useRef(null)
	const [, drop] = useDrop<BackupsTableRowDragData>({
		accept: 'backup-rule',
		hover(hoverItem, monitor) {
			if (!ref.current) {
				return
			}
			// Don't replace items with themselves
			if (hoverItem.id === rule.id) {
				return
			}

			if (!checkDragState(hoverItem, monitor, rule.id)) return

			// Time to actually perform the action
			moveRule(hoverItem.id, rule.id)
		},
	})

	const [{ isDragging }, drag, preview] = useDrag<BackupsTableRowDragData, unknown, BackupsTableRowDragStatus>({
		type: 'backup-rule',
		item: {
			id: rule.id,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/settings/backups/$ruleId' })
	const isSelected = routeMatch && routeMatch.ruleId === rule.id

	const backupTypeLabel =
		backupTypes.find((type: { label: string; value: string }) => type.value === rule.backupType)?.label ||
		rule.backupType

	return (
		<tr
			ref={ref}
			className={classNames({
				'connectionlist-dragging': isDragging,
				'connectionlist-notdragging': !isDragging,
				'connectionlist-selected': isSelected,
			})}
		>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
				<GenericConfirmModal ref={confirmRef} />
			</td>
			<td onClick={doEdit} className="hand">
				<b>{rule.name}</b>
				<br />
				<small>Format: {backupTypeLabel}</small>
			</td>
			<td onClick={doEdit} className="hand">
				<small>Cron: {rule.cron}</small>
				<br />
				{rule.lastRan ? <small>Last run: {dayjs(rule.lastRan).format('MM/DD HH:mm:ss')}</small> : ''}
			</td>
			<td className="action-buttons">
				<CButtonGroup>
					<CFormSwitch
						className="connection-enabled-switch ms-2"
						color="success"
						checked={rule.enabled}
						onChange={doEnableDisable}
						title={rule.enabled ? 'Disable rule' : 'Enable rule'}
						size="xl"
					/>

					<CButton color="gray" onClick={doDelete} title="Delete">
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
}
