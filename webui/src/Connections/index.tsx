import { CCol, CRow, CTabContent, CTabPane, CNavItem, CNavLink, CNav } from '@coreui/react'
import React, { useCallback, useContext, useState } from 'react'
import { assertNever, MyErrorBoundary } from '~/util.js'
import { ConnectionsList } from './ConnectionList/ConnectionList.js'
import { AddConnectionsPanel } from './AddConnectionPanel.js'
import { ConnectionEditPanel } from './ConnectionEdit/ConnectionEditPanel.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import classNames from 'classnames'
import { useMatchRoute, useNavigate, UseNavigateResult } from '@tanstack/react-router'
import { ConnectionsStore } from '~/Stores/ConnectionsStore.js'

type ConnectionTab = { type: 'add' } | { type: 'edit'; connectionId: string }

function equalTabs(t1: ConnectionTab, t2: ConnectionTab): boolean {
	switch (t1.type) {
		case 'add':
			return t2.type === 'add'
		case 'edit':
			return t2.type === 'edit' && t1.connectionId === t2.connectionId
		default:
			assertNever(t1)
			return false
	}
}

function useConnectionActiveTab(connections: ConnectionsStore): ConnectionTab | null {
	const matchRoute = useMatchRoute()

	if (matchRoute({ to: '/connections' })) {
		return { type: 'add' }
	}

	const match = matchRoute({ to: '/connections/$connectionId' })
	if (match && connections.connections.has(match.connectionId)) {
		return { type: 'edit', connectionId: match.connectionId }
	}

	return null
}

function navigateToConnectionTab(navigate: UseNavigateResult<'/connections'>, tab: ConnectionTab): void {
	switch (tab.type) {
		case 'edit':
			void navigate({ to: `/connections/${tab.connectionId}` })
			return
		case 'add':
			break
		default:
			assertNever(tab)
	}

	void navigate({ to: `/connections` })
}

export function ConnectionsPage(): React.JSX.Element {
	const { connections } = useContext(RootAppStoreContext)

	const [tabResetToken, setTabResetToken] = useState(nanoid())

	const navigate = useNavigate({ from: '/connections' })

	let activeTab = useConnectionActiveTab(connections)
	if (activeTab === null) {
		setTimeout(() => navigateToConnectionTab(navigate, { type: 'add' }), 0)
		activeTab = { type: 'add' } // continue rendering as if adding
	}

	const setActiveTab = useCallback(
		(tab: ConnectionTab) => {
			navigateToConnectionTab(navigate, tab)
		},
		[navigate]
	)

	const doChangeTab = useCallback(
		(newTab: ConnectionTab) => {
			if (!equalTabs(activeTab, newTab)) {
				setTabResetToken(nanoid())
				setActiveTab(newTab)
			}
		},
		[activeTab, setActiveTab]
	)

	const doConfigureConnection = useCallback(
		(connectionId: string | null) => {
			setTabResetToken(nanoid())
			setActiveTab(connectionId ? { type: 'edit', connectionId } : { type: 'add' })
		},
		[setTabResetToken, setActiveTab]
	)

	return (
		<CRow className="connections-page split-panels">
			<CCol xl={6} className="connections-panel primary-panel">
				<ConnectionsList
					doConfigureConnection={doConfigureConnection}
					selectedConnectionId={activeTab.type === 'edit' ? activeTab.connectionId : null}
				/>
			</CCol>

			<CCol xl={6} className="connections-panel secondary-panel add-connections-panel">
				<div className="secondary-panel-inner">
					<CNav variant="tabs">
						<CNavItem>
							<CNavLink active={activeTab.type === 'add'} onClick={() => doChangeTab({ type: 'add' })}>
								<FontAwesomeIcon icon={faPlus} /> Add connection
							</CNavLink>
						</CNavItem>
						<CNavItem
							className={classNames({
								hidden: activeTab.type === 'add',
							})}
						>
							<CNavLink active={activeTab.type === 'edit'}>
								<FontAwesomeIcon icon={faCog} /> Edit connection
							</CNavLink>
						</CNavItem>
					</CNav>
					<CTabContent>
						<CTabPane role="tabpanel" aria-labelledby="add-tab" visible={activeTab.type === 'add'}>
							<MyErrorBoundary>
								<AddConnectionsPanel doConfigureConnection={doConfigureConnection} />
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane role="tabpanel" aria-labelledby="edit-tab" visible={activeTab.type === 'edit'}>
							<MyErrorBoundary>
								{activeTab.type === 'edit' && (
									<ConnectionEditPanel
										key={tabResetToken}
										doConfigureConnection={doConfigureConnection}
										connectionId={activeTab.connectionId}
									/>
								)}
							</MyErrorBoundary>
						</CTabPane>
					</CTabContent>
				</div>
			</CCol>
		</CRow>
	)
}
