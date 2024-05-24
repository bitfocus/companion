import { CCol, CRow, CTabContent, CTabPane, CNavItem, CNavLink, CNav } from '@coreui/react'
import React, { memo, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { HelpModal, HelpModalRef } from './HelpModal.js'
import { MyErrorBoundary, socketEmitPromise } from '../util.js'
import { ConnectionsList } from './ConnectionList.js'
import { AddConnectionsPanel } from './AddConnection.js'
import { ConnectionEditPanel } from './ConnectionEditPanel.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import classNames from 'classnames'

export const ConnectionsPage = memo(function ConnectionsPage() {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const helpModalRef = useRef<HelpModalRef>(null)

	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState<'add' | 'edit'>('add')
	const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
	const doChangeTab = useCallback((newTab: 'add' | 'edit') => {
		setActiveTab((oldTab) => {
			if (oldTab !== newTab) {
				setSelectedConnectionId(null)
				setTabResetToken(nanoid())
			}
			return newTab
		})
	}, [])

	const showHelp = useCallback(
		(id: string) => {
			socketEmitPromise(socket, 'connections:get-help', [id]).then(([err, result]) => {
				if (err) {
					notifier.current?.show('Instance help', `Failed to get help text: ${err}`)
					return
				}
				if (result) {
					helpModalRef.current?.show(id, result)
				}
			})
		},
		[socket, notifier]
	)

	const doConfigureConnection = useCallback((connectionId: string | null) => {
		setSelectedConnectionId(connectionId)
		setTabResetToken(nanoid())
		setActiveTab(connectionId ? 'edit' : 'add')
	}, [])

	const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatusEntry> | undefined>()
	useEffect(() => {
		let mounted = true
		socketEmitPromise(socket, 'connections:get-statuses', [])
			.then((statuses) => {
				if (!mounted) return
				setConnectionStatus(statuses)
			})
			.catch((e) => {
				console.error(`Failed to load connection statuses`, e)
			})

		const patchStatuses = (patch: JsonPatchOperation[]) => {
			if (!mounted) return
			setConnectionStatus((oldStatuses) => {
				if (!oldStatuses) return oldStatuses
				return jsonPatch.applyPatch(cloneDeep(oldStatuses) || {}, patch).newDocument
			})
		}
		socket.on('connections:patch-statuses', patchStatuses)

		return () => {
			mounted = false
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
					<CNav variant="tabs">
						<CNavItem>
							<CNavLink active={activeTab === 'add'} onClick={() => doChangeTab('add')}>
								<FontAwesomeIcon icon={faPlus} /> Add connection
							</CNavLink>
						</CNavItem>
						<CNavItem
							className={classNames({
								hidden: !selectedConnectionId,
							})}
						>
							<CNavLink active={activeTab === 'edit'} onClick={() => doChangeTab('edit')}>
								<FontAwesomeIcon icon={faCog} /> Edit connection
							</CNavLink>
						</CNavItem>
					</CNav>
					<CTabContent className="remove075right">
						<CTabPane role="tabpanel" aria-labelledby="add-tab" visible={activeTab === 'add'}>
							<MyErrorBoundary>
								<AddConnectionsPanel showHelp={showHelp} doConfigureConnection={doConfigureConnection} />
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane role="tabpanel" aria-labelledby="edit-tab" visible={activeTab === 'edit'}>
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
				</div>
			</CCol>
		</CRow>
	)
})
