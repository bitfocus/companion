import React, { useCallback, useContext, useRef, useState } from 'react'
import { CAlert, CButton, CButtonGroup, CCallout } from '@coreui/react'
import { socketEmitPromise } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faSync } from '@fortawesome/free-solid-svg-icons'
import { AddSurfaceGroupModal, AddSurfaceGroupModalRef } from './AddGroupModal.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { SurfaceDiscoveryTable } from './SurfaceDiscoveryTable.js'
import { KnownSurfacesTable } from './KnownSurfacesTable.js'

export const SurfacesPage = observer(function SurfacesPage() {
	const { socket } = useContext(RootAppStoreContext)

	const addGroupModalRef = useRef<AddSurfaceGroupModalRef>(null)

	const [scanning, setScanning] = useState(false)
	const [scanError, setScanError] = useState<string | null>(null)

	const refreshUSB = useCallback(() => {
		setScanning(true)
		setScanError(null)

		socketEmitPromise(socket, 'surfaces:rescan', [], 30000)
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
		socketEmitPromise(socket, 'surfaces:emulator-add', []).catch((err) => {
			console.error('Emulator add failed', err)
		})
	}, [socket])
	const addGroup = useCallback(() => {
		addGroupModalRef.current?.show()
	}, [socket])

	return (
		<div>
			<h4>Surfaces</h4>
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

			<SurfaceDiscoveryTable />

			<KnownSurfacesTable />

			<CCallout color="info">
				Did you know, you can connect a Streamdeck from another computer or Raspberry Pi with{' '}
				<a target="_blank" rel="noreferrer" href="https://bitfocus.io/companion-satellite?companion-inapp-didyouknow">
					Companion Satellite
				</a>
				?
			</CCallout>
		</div>
	)
})
