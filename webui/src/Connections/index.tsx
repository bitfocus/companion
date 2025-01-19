import { CCol, CRow, CTabContent, CTabPane, CNavItem, CNavLink, CNav } from '@coreui/react'
import React, { memo, useCallback, useContext, useEffect, useState } from 'react'
import { MyErrorBoundary } from '../util.js'
import { ConnectionsList } from './ConnectionList.js'
import { AddConnectionsPanel } from './AddConnectionPanel.js'
import { ConnectionEditPanel } from './ConnectionEditPanel.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import classNames from 'classnames'

export const ConnectionsPage = memo(function ConnectionsPage() {
	const { socket } = useContext(RootAppStoreContext)

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

	const doConfigureConnection = useCallback((connectionId: string | null) => {
		setSelectedConnectionId(connectionId)
		setTabResetToken(nanoid())
		setActiveTab(connectionId ? 'edit' : 'add')
	}, [])

	const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatusEntry> | undefined>()
	useEffect(() => {
		let mounted = true
		socket
			.emitPromise('connections:get-statuses', [])
			.then((statuses) => {
				if (!mounted) return
				setConnectionStatus(statuses)
			})
			.catch((e) => {
				console.error(`Failed to load connection statuses`, e)
			})

		const unsubStatuses = socket.on('connections:patch-statuses', (patch) => {
			if (!mounted) return
			setConnectionStatus((oldStatuses) => {
				if (!oldStatuses) return oldStatuses
				return jsonPatch.applyPatch(cloneDeep(oldStatuses) || {}, patch).newDocument
			})
		})

		return () => {
			mounted = false
			unsubStatuses()
		}
	}, [socket])

	return (
		<CRow className="connections-page split-panels">
			<CCol xl={6} className="connections-panel primary-panel">
				<ConnectionsList
					connectionStatus={connectionStatus}
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
					<CTabContent>
						<CTabPane role="tabpanel" aria-labelledby="add-tab" visible={activeTab === 'add'}>
							<MyErrorBoundary>
								<AddConnectionsPanel doConfigureConnection={doConfigureConnection} />
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane role="tabpanel" aria-labelledby="edit-tab" visible={activeTab === 'edit'}>
							<MyErrorBoundary>
								{selectedConnectionId && (
									<ConnectionEditPanel
										key={tabResetToken}
										doConfigureConnection={doConfigureConnection}
										connectionId={selectedConnectionId}
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
