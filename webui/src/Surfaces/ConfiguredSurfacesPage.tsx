import { CRow, CCol, CAlert, CButtonGroup, CButton, CCallout } from '@coreui/react'
import { faSync, faAdd } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useRef, useState, useCallback } from 'react'
import { AddEmulatorModalRef, AddEmulatorModal } from './AddEmulatorModal'
import { AddSurfaceGroupModalRef, AddSurfaceGroupModal } from './AddGroupModal'
import { KnownSurfacesTable } from './KnownSurfacesTable'
import { MyErrorBoundary } from '~/util.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { trpc } from '~/TRPC'
import { useMutation } from '@tanstack/react-query'

export const ConfiguredSurfacesPage = observer(function ConfiguredSurfacesPage(): React.JSX.Element {
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()

	const routeMatch = matchRoute({ to: '/surfaces/configured/$itemId' })
	const selectedItemId = routeMatch ? routeMatch.itemId : null

	const addGroupModalRef = useRef<AddSurfaceGroupModalRef>(null)
	const addEmulatorModalRef = useRef<AddEmulatorModalRef>(null)

	const [scanError, setScanError] = useState<string | null>(null)

	const rescanUsbMutation = useMutation(trpc.surfaces.rescanUsb.mutationOptions())
	const rescanUsbMutationAsync = rescanUsbMutation.mutateAsync

	const refreshUSB = useCallback(() => {
		setScanError(null)

		rescanUsbMutationAsync() // TODO: 30s timeout?
			.then((errorMsg) => {
				setScanError(errorMsg || null)
			})
			.catch((err) => {
				console.error('Refresh USB failed', err)
			})
	}, [rescanUsbMutationAsync])

	const addEmulator = useCallback(() => {
		addEmulatorModalRef.current?.show()
	}, [])
	const addGroup = useCallback(() => {
		addGroupModalRef.current?.show()
	}, [])

	const selectItem = useCallback(
		(itemId: string | null) => {
			if (itemId === null) {
				void navigate({ to: '/surfaces/configured' })
			} else {
				void navigate({
					to: '/surfaces/configured/$itemId',
					params: {
						itemId: itemId,
					},
				})
			}
		},
		[navigate]
	)

	const showPrimaryPanel = !selectedItemId
	const showSecondaryPanel = !!selectedItemId

	return (
		<CRow className="surfaces-page split-panels">
			<CCol
				xs={12}
				xl={6}
				className={`primary-panel ${showPrimaryPanel ? '' : 'd-xl-block d-none'} flex-column-layout`}
			>
				<div className="fixed-header">
					<h4>Configured Surfaces</h4>

					<p style={{ marginBottom: '0.5rem' }}>
						Currently connected surfaces. If your streamdeck is missing from this list, you might need to close the
						Elgato Streamdeck application and click the Rescan button below.
					</p>

					<CAlert color="warning" role="alert" style={{ display: scanError ? '' : 'none' }}>
						{scanError}
					</CAlert>

					<CButtonGroup size="sm">
						<CButton color="warning" onClick={refreshUSB}>
							<FontAwesomeIcon icon={faSync} spin={rescanUsbMutation.isPending} />
							{rescanUsbMutation.isPending ? ' Checking for new surfaces...' : ' Rescan USB'}
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
				</div>

				<div className="scrollable-content">
					<KnownSurfacesTable selectedItemId={selectedItemId} selectItem={selectItem} />

					<CCallout color="info">
						Did you know, you can connect a Streamdeck from another computer or Raspberry Pi with{' '}
						<a target="_blank" rel="noreferrer" href="https://bfoc.us/70n2m47akw">
							Companion Satellite
						</a>
						?
					</CCallout>
				</div>
			</CCol>

			<CCol xs={12} xl={6} className={`secondary-panel ${showSecondaryPanel ? '' : 'd-xl-block d-none'}`}>
				<div className="secondary-panel-simple">
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</CCol>
		</CRow>
	)
})
