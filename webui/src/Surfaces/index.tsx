import React, { useCallback, useContext, useRef, useState } from 'react'
import { CAlert, CButton, CButtonGroup, CCallout, CCol, CRow } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faSync } from '@fortawesome/free-solid-svg-icons'
import { AddSurfaceGroupModal, AddSurfaceGroupModalRef } from './AddGroupModal.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { SurfaceDiscoveryTable } from './SurfaceDiscoveryTable.js'
import { KnownSurfacesTable } from './KnownSurfacesTable.js'
import { OutboundSurfacesTable } from './OutboundSurfacesTable.js'

export function ConfiguredSurfacesTab() {
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
		<CRow>
			<CCol xs={12}>
				<h4>Configured Surfaces</h4>

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
			</CCol>
		</CRow>
	)
}

export function DiscoverSurfacesTab() {
	return (
		<CRow>
			<CCol xs={12}>
				<h4>Discover Surfaces</h4>

				<p style={{ marginBottom: '0.5rem' }}>
					Discovered remote surfaces, such as Companion Satellite and Stream Deck Studio will be listed here. You can
					easily configure them to connect to Companion from here.
					<br />
					This requires Companion Satellite version 1.9.0 and later.
				</p>

				<SurfaceDiscoveryTable />
			</CCol>
		</CRow>
	)
}

export function OutboundSurfacesTab() {
	return (
		<CRow>
			<CCol xs={12}>
				<h4>Remote Surfaces</h4>

				<p style={{ marginBottom: '0.5rem' }}>
					The Stream Deck Studio supports network connection. You can set up the connection from Companion here, or use
					the Discovered Surfaces tab.
					<br />
					This is not suitable for all remote surfaces such as Satellite, as that opens the connection to Companion
					itself.
				</p>

				<OutboundSurfacesTable />
			</CCol>
		</CRow>
	)
}
