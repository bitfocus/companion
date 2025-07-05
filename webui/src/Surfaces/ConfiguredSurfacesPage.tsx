import { CRow, CCol, CAlert, CButtonGroup, CButton, CCallout } from '@coreui/react'
import { faSync, faAdd } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useContext, useRef, useState, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { AddEmulatorModalRef, AddEmulatorModal } from './AddEmulatorModal'
import { AddSurfaceGroupModalRef, AddSurfaceGroupModal } from './AddGroupModal'
import { KnownSurfacesTable } from './KnownSurfacesTable'

export function ConfiguredSurfacesPage(): React.JSX.Element {
	const { socket } = useContext(RootAppStoreContext)

	const addGroupModalRef = useRef<AddSurfaceGroupModalRef>(null)
	const addEmulatorModalRef = useRef<AddEmulatorModalRef>(null)

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
		addEmulatorModalRef.current?.show()
	}, [])
	const addGroup = useCallback(() => {
		addGroupModalRef.current?.show()
	}, [])

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
				<AddEmulatorModal ref={addEmulatorModalRef} />

				<KnownSurfacesTable />

				<CCallout color="info">
					Did you know, you can connect a Streamdeck from another computer or Raspberry Pi with{' '}
					<a target="_blank" rel="noreferrer" href="https://bfoc.us/70n2m47akw">
						Companion Satellite
					</a>
					?
				</CCallout>
			</CCol>
		</CRow>
	)
}
