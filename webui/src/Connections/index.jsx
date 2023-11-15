import { CCol, CRow, CTabs, CTabContent, CTabPane, CNavItem, CNavLink, CNav } from '@coreui/react'
import { memo, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { HelpModal } from './HelpModal'
import { NotifierContext, MyErrorBoundary, socketEmitPromise, SocketContext } from '../util'
import { ConnectionsList } from './ConnectionList'
import { AddConnectionsPanel } from './AddConnection'
import { ConnectionEditPanel } from './ConnectionEditPanel'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

export const ConnectionsPage = memo(function ConnectionsPage() {
	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)

	const helpModalRef = useRef()

	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState('add')
	const [selectedConnectionId, setSelectedConnectionId] = useState(null)
	const doChangeTab = useCallback((newTab) => {
		setActiveTab((oldTab) => {
			if (oldTab !== newTab) {
				setSelectedConnectionId(null)
				setTabResetToken(nanoid())
			}
			return newTab
		})
	}, [])

	const showHelp = useCallback(
		(id) => {
			socketEmitPromise(socket, 'connections:get-help', [id]).then(([err, result]) => {
				if (err) {
					notifier.current.show('Instance help', `Failed to get help text: ${err}`)
					return
				}
				if (result) {
					helpModalRef.current?.show(id, result)
				}
			})
		},
		[socket, notifier]
	)

	const doConfigureConnection = useCallback((id) => {
		setSelectedConnectionId(id)
		setTabResetToken(nanoid())
		setActiveTab(id ? 'edit' : 'add')
	}, [])

	const [connectionStatus, setConnectionStatus] = useState(null)
	useEffect(() => {
		socketEmitPromise(socket, 'connections:get-statuses', [])
			.then((statuses) => {
				setConnectionStatus(statuses)
			})
			.catch((e) => {
				console.error(`Failed to load connection statuses`, e)
			})

		const patchStatuses = (patch) => {
			setConnectionStatus((oldStatuses) => {
				if (!oldStatuses) return oldStatuses
				return jsonPatch.applyPatch(cloneDeep(oldStatuses) || {}, patch).newDocument
			})
		}
		socket.on('connections:patch-statuses', patchStatuses)

		return () => {
			socket.off('connections:patch-statuses', patchStatuses)
		}
	}, [socket])

	return (
		<CRow className="connections-page split-panels">
			<HelpModal ref={helpModalRef} />

			<CCol xl={6} className="connections-panel primary-panel">
				<ConnectionsList
					connectionStatus={connectionStatus}
					showHelp={showHelp}
					doConfigureConnection={doConfigureConnection}
					selectedConnectionId={selectedConnectionId}
				/>
			</CCol>

			<CCol xl={6} className="connections-panel secondary-panel add-connections-panel">
				<div className="secondary-panel-inner">
					<CTabs activeTab={activeTab} onActiveTabChange={doChangeTab}>
						<CNav variant="tabs">
							<CNavItem>
								<CNavLink data-tab="add">
									<FontAwesomeIcon icon={faPlus} /> Add connection
								</CNavLink>
							</CNavItem>
							<CNavItem hidden={!selectedConnectionId}>
								<CNavLink data-tab="edit">
									<FontAwesomeIcon icon={faCog} /> Edit connection
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent fade={false} className="remove075right">
							<CTabPane data-tab="add">
								<MyErrorBoundary>
									<AddConnectionsPanel showHelp={showHelp} doConfigureConnection={doConfigureConnection} />
								</MyErrorBoundary>
							</CTabPane>
							<CTabPane data-tab="edit">
								<MyErrorBoundary>
									{selectedConnectionId && (
										<ConnectionEditPanel
											key={tabResetToken}
											showHelp={showHelp}
											doConfigureConnection={doConfigureConnection}
											connectionId={selectedConnectionId}
											connectionStatus={connectionStatus?.[selectedConnectionId]}
										/>
									)}
								</MyErrorBoundary>
							</CTabPane>
						</CTabContent>
					</CTabs>
				</div>
			</CCol>
		</CRow>
	)
})
