import React, { useCallback, useContext, useRef, useState } from 'react'
import { CAlert, CButton, CButtonGroup, CCallout, CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { MyErrorBoundary } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faSync } from '@fortawesome/free-solid-svg-icons'
import { AddSurfaceGroupModal, AddSurfaceGroupModalRef } from './AddGroupModal.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { SurfaceDiscoveryTable } from './SurfaceDiscoveryTable.js'
import { KnownSurfacesTable } from './KnownSurfacesTable.js'
import { NavLink, NavigateFunction, useLocation, useNavigate } from 'react-router-dom'
import { OutboundSurfacesTable } from './OutboundSurfacesTable.js'

export const SURFACES_PAGE_PREFIX = '/surfaces'

type SubPageType = 'configured' | 'discover' | 'outbound'

function useSurfacesSubPage(): SubPageType | null | false {
	const routerLocation = useLocation()
	if (!routerLocation.pathname.startsWith(SURFACES_PAGE_PREFIX)) return false
	const fragments = routerLocation.pathname.slice(SURFACES_PAGE_PREFIX.length + 1).split('/')
	const subPage = fragments[0]
	if (!subPage) return null

	if (subPage !== 'configured' && subPage !== 'discover' && subPage !== 'outbound') return null

	return subPage
}

function navigateToSubPage(navigate: NavigateFunction, subPage: SubPageType | null): void {
	if (!subPage) subPage = 'configured'

	navigate(`${SURFACES_PAGE_PREFIX}/${subPage}`)
}

export const SurfacesPage = observer(function SurfacesPage() {
	const navigate = useNavigate()

	const subPage = useSurfacesSubPage()
	console.log('subPage', subPage)
	if (subPage === false) return null
	if (!subPage) {
		setTimeout(() => navigateToSubPage(navigate, null), 0)
		return null
	}

	return (
		<div className="secondary-panel fill-height">
			<div className="secondary-panel-header">
				<h4>Surfaces</h4>
			</div>

			<div className="secondary-panel-inner">
				<CNav variant="tabs" role="tablist">
					<CNavItem>
						<CNavLink to={`${SURFACES_PAGE_PREFIX}/configured`} as={NavLink}>
							Configured Surfaces
						</CNavLink>
					</CNavItem>
					<CNavItem>
						<CNavLink to={`${SURFACES_PAGE_PREFIX}/discover`} as={NavLink}>
							Discover
						</CNavLink>
					</CNavItem>
					<CNavItem>
						<CNavLink to={`${SURFACES_PAGE_PREFIX}/outbound`} as={NavLink}>
							Remote Surfaces
						</CNavLink>
					</CNavItem>
				</CNav>
				<CTabContent>
					<CTabPane data-tab="configured" visible={subPage === 'configured'} transition={false}>
						<MyErrorBoundary>
							<ConfiguredSurfacesTab />
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="discover" visible={subPage === 'discover'} transition={false}>
						<MyErrorBoundary>
							<DiscoverSurfacesTab />
						</MyErrorBoundary>
					</CTabPane>
					<CTabPane data-tab="outbound" visible={subPage === 'outbound'} transition={false}>
						<MyErrorBoundary>
							<OutboundSurfacesTab />
						</MyErrorBoundary>
					</CTabPane>
				</CTabContent>
			</div>
		</div>
	)
})

function ConfiguredSurfacesTab() {
	const { socket } = useContext(RootAppStoreContext)

	const addGroupModalRef = useRef<AddSurfaceGroupModalRef>(null)

	const [scanning, setScanning] = useState(false)
	const [scanError, setScanError] = useState<string | null>(null)

	const refreshUSB = useCallback(() => {
		setScanning(true)
		setScanError(null)

		socket
			.emitPromise('surfaces:rescan', [], 30000)
			.then((errorMsg) => {
				setScanError(errorMsg || null)
				setScanning(false)
			})
			.catch((err) => {
				console.error('Refresh USB failed', err)

				setScanning(false)
			})
	}, [socket])

	const addEmulator = useCallback(() => {
		socket.emitPromise('surfaces:emulator-add', []).catch((err) => {
			console.error('Emulator add failed', err)
		})
	}, [socket])
	const addGroup = useCallback(() => {
		addGroupModalRef.current?.show()
	}, [socket])

	return (
		<>
			<p style={{ marginBottom: '0.5rem' }}>
				Currently connected surfaces. If your streamdeck is missing from this list, you might need to close the Elgato
				Streamdeck application and click the Rescan button below.
			</p>

			<CAlert color="warning" role="alert" style={{ display: scanError ? '' : 'none' }}>
				{scanError}
			</CAlert>

			<CButtonGroup size="sm">
				<CButton color="warning" onClick={refreshUSB}>
					<FontAwesomeIcon icon={faSync} spin={scanning} />
					{scanning ? ' Checking for new surfaces...' : ' Rescan USB'}
				</CButton>
				<CButton color="primary" onClick={addEmulator}>
					<FontAwesomeIcon icon={faAdd} /> Add Emulator
				</CButton>
				<CButton color="secondary" onClick={addGroup}>
					<FontAwesomeIcon icon={faAdd} /> Add Group
				</CButton>
			</CButtonGroup>

			<AddSurfaceGroupModal ref={addGroupModalRef} />

			<KnownSurfacesTable />

			<CCallout color="info">
				Did you know, you can connect a Streamdeck from another computer or Raspberry Pi with{' '}
				<a target="_blank" rel="noreferrer" href="https://bitfocus.io/companion-satellite?companion-inapp-didyouknow">
					Companion Satellite
				</a>
				?
			</CCallout>
		</>
	)
}

function DiscoverSurfacesTab() {
	return (
		<>
			<p style={{ marginBottom: '0.5rem' }}>
				Discovered remote surfaces, such as Companion Satellite and Stream Deck Studio will be listed here. You can
				easily configure them to connect to Companion from here.
				<br />
				This requires Companion Satellite version 1.9.0 and later.
			</p>

			<SurfaceDiscoveryTable />
		</>
	)
}

function OutboundSurfacesTab() {
	return (
		<>
			<p style={{ marginBottom: '0.5rem' }}>
				The Stream Deck Studio supports network connection. You can set up the connection from Companion here, or use
				the Discovered Surfaces tab.
				<br />
				This is not suitable for all remote surfaces such as Satellite, as that opens the connection to Companion
				itself.
			</p>

			<OutboundSurfacesTable />
		</>
	)
}
