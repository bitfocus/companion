import { CFormSwitch, CPopover, CButtonGroup, CButton } from '@coreui/react'
import {
	faSort,
	faExclamationTriangle,
	faQuestionCircle,
	faBug,
	faDollarSign,
	faTerminal,
	faTrash,
	faEllipsisV,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { RefObject, useContext, useCallback, useRef } from 'react'
import { useDrop, useDrag } from 'react-dnd'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { Tuck } from '../../Components/Tuck.js'
import { windowLinkOpen } from '../../Helpers/Window.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { UpdateConnectionToLatestButton } from '../UpdateConnectionToLatestButton.js'
import { getModuleVersionInfoForConnection } from '../Util.js'
import { ClientConnectionConfigWithId, ConnectionDragItem, ConnectionDragStatus } from './ConnectionList.js'
import { ConnectionStatusCell } from './ConnectionStatusCell.js'
import { checkDragState } from '../../util.js'

interface ConnectionsTableRowProps {
	id: string
	index: number
	connection: ClientConnectionConfigWithId
	showVariables: (label: string) => void
	configureConnection: (connectionId: string | null) => void
	deleteModalRef: RefObject<GenericConfirmModalRef>
	isSelected: boolean
}
export const ConnectionsTableRow = observer(function ConnectionsTableRow({
	id,
	index,
	connection,
	showVariables,
	configureConnection,
	deleteModalRef,
	isSelected,
}: ConnectionsTableRowProps) {
	const { socket, helpViewer, modules, variablesStore } = useContext(RootAppStoreContext)

	const moduleInfo = modules.modules.get(connection.instance_type)

	const isEnabled = connection.enabled === undefined || connection.enabled

	const doDelete = useCallback(() => {
		deleteModalRef.current?.show(
			'Delete connection',
			[
				`Are you sure you want to delete "${connection.label}"?`,
				'This will remove all actions and feedbacks associated with this connection.',
			],
			'Delete',
			() => {
				socket.emitPromise('connections:delete', [id]).catch((e) => {
					console.error('Delete failed', e)
				})
				configureConnection(null)
			}
		)
	}, [socket, deleteModalRef, id, connection.label, configureConnection])

	const doToggleEnabled = useCallback(() => {
		socket.emitPromise('connections:set-enabled', [id, !isEnabled]).catch((e) => {
			console.error('Set enabled failed', e)
		})
	}, [socket, id, isEnabled])

	const doShowVariables = useCallback(() => showVariables(connection.label), [showVariables, connection.label])

	const ref = useRef(null)
	const [, drop] = useDrop<ConnectionDragItem>({
		accept: 'connection',
		hover(item, monitor) {
			if (!ref.current) {
				return
			}

			if (!checkDragState(item, monitor, id)) return

			// Don't replace items with themselves
			if (item.connectionId === id) {
				return
			}

			// Time to actually perform the action
			socket.emitPromise('connections:reorder', [connection.groupId ?? null, item.connectionId, index]).catch((e) => {
				console.error('Reorder failed', e)
			})

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = index
			item.groupId = connection.groupId ?? null
		},
	})
	const [{ isDragging }, drag, preview] = useDrag<ConnectionDragItem, unknown, ConnectionDragStatus>({
		type: 'connection',
		item: {
			connectionId: id,
			groupId: connection.groupId ?? null,
			index,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	const connectionVariables = variablesStore.variables.get(connection.label)

	const doEdit = useCallback(() => configureConnection(id), [id])

	const openBugUrl = useCallback(() => {
		const url = moduleInfo?.display?.bugUrl
		if (url) windowLinkOpen({ href: url })
	}, [moduleInfo])

	const moduleVersion = getModuleVersionInfoForConnection(moduleInfo, connection.moduleVersionId)

	const doShowHelp = useCallback(
		() =>
			moduleVersion?.helpPath &&
			helpViewer.current?.showFromUrl(connection.instance_type, moduleVersion.versionId, moduleVersion.helpPath),
		[helpViewer, connection.instance_type, moduleVersion]
	)

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
			</td>
			<td onClick={doEdit} className="hand">
				<b>{connection.label}</b>
			</td>
			<td onClick={doEdit} className="hand">
				{moduleInfo ? (
					<>
						{moduleInfo.display.shortname ?? ''}
						<br />
						{moduleInfo.display.manufacturer ?? ''}
						<br />
						{moduleVersion?.isLegacy && (
							<>
								<FontAwesomeIcon
									icon={faExclamationTriangle}
									color="#f80"
									title="This module has not been updated for Companion 3.0, and may not work fully"
								/>{' '}
							</>
						)}
						{moduleVersion?.displayName ?? connection.moduleVersionId}
					</>
				) : (
					<>
						{connection.instance_type}
						<br />
						{connection.moduleVersionId}
					</>
				)}
				<UpdateConnectionToLatestButton connection={connection} />
			</td>
			<td className="hand" onClick={doEdit}>
				<ConnectionStatusCell isEnabled={isEnabled} status={connection.status} />
			</td>
			<td className="action-buttons">
				<div style={{ display: 'flex' }}>
					<div>
						<CFormSwitch
							className="connection-enabled-switch"
							disabled={!moduleInfo || !moduleVersion}
							color="success"
							checked={isEnabled}
							onChange={doToggleEnabled}
							size="xl"
							title={isEnabled ? 'Disable connection' : 'Enable connection'}
						/>
					</div>
					<CPopover
						trigger="focus"
						placement="right"
						style={{ backgroundColor: 'white' }}
						content={
							<>
								{/* Note: the popover closing due to focus loss stops mouseup/click events propagating */}
								<CButtonGroup vertical>
									<CButton
										onMouseDown={doShowHelp}
										color="secondary"
										title="Help"
										disabled={!moduleVersion?.helpPath}
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faQuestionCircle} />
										</Tuck>
										Help
									</CButton>

									<CButton
										onMouseDown={openBugUrl}
										color="secondary"
										title="Issue Tracker"
										disabled={!moduleInfo?.display?.bugUrl}
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faBug} />
										</Tuck>
										Known issues
									</CButton>

									<CButton
										onMouseDown={doShowVariables}
										title="Variables"
										color="secondary"
										disabled={!isEnabled || !(connectionVariables && connectionVariables.size > 0)}
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faDollarSign} />
										</Tuck>
										Variables
									</CButton>

									<CButton
										onMouseDown={() => windowLinkOpen({ href: `/connection-debug/${id}`, title: 'View debug log' })}
										title="Logs"
										color="secondary"
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faTerminal} />
										</Tuck>
										View logs
									</CButton>

									<CButton onMouseDown={doDelete} title="Delete" color="secondary" style={{ textAlign: 'left' }}>
										<Tuck>
											<FontAwesomeIcon icon={faTrash} />
										</Tuck>
										Delete
									</CButton>
								</CButtonGroup>
							</>
						}
					>
						<CButton color="secondary" style={{ padding: '3px 16px' }} onClick={(e) => e.currentTarget.focus()}>
							<FontAwesomeIcon icon={faEllipsisV} />
						</CButton>
					</CPopover>
				</div>
			</td>
		</tr>
	)
})
