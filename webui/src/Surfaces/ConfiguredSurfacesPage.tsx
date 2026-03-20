import { CCol, CRow, CAlert, CButtonGroup, CButton, CCallout } from '@coreui/react'
import { faSync, faAdd, faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useRef, useState, useCallback, useEffect } from 'react'
import { AddEmulatorModal, type AddEmulatorModalRef } from './AddEmulatorModal'
import { AddSurfaceGroupModal, type AddSurfaceGroupModalRef } from './AddGroupModal'
import { KnownSurfacesTable } from './KnownSurfacesTable'
import { MyErrorBoundary } from '~/Resources/Error'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { trpc } from '~/Resources/TRPC'
import { useMutation } from '@tanstack/react-query'
import debounceFn from 'debounce-fn'

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

	// Handle the various cases in which we want to show the settings panel (when window is narrow)
	// 1. if one of the integration subpanels are currently visible or user clicked Show Settings
	const showSettings = matchRoute({ to: '/surfaces/configured/integrations', fuzzy: true })
	// 2. specific action when the user clicks the "Show Settings" button
	const handleShowSettings = useCallback(() => {
		void navigate({ to: '/surfaces/configured/integrations' })
	}, [navigate])

	// 3. Handle changes in panel visibility
	const primaryPanelRef = useRef<React.ElementRef<typeof CCol>>(null)
	useEffect(() => {
		// if left-panel is visible and we're at the top-level, remove the "integrations" route-placeholder
		const checkVisibility = () => {
			const pRef = primaryPanelRef.current
			const showingOverview = matchRoute({ to: '/surfaces/configured/integrations', fuzzy: false })
			if (showSettings && pRef) {
				if (showingOverview && getComputedStyle(pRef).display !== 'none') {
					// Turn off showSettings if the user widens the window enough to expose the left panel.
					// this prevents a possibly confusing results of the setting showing up "spontaneously" if the window narrows again.
					void navigate({ to: '/surfaces/configured' })
				}
			}
		}

		checkVisibility() // run once, immediately on mount or changed dependency.
		// handle window-size change. Use debounce so it only fires once at the end of resizing.
		const handler = debounceFn(
			checkVisibility,
			{ wait: 1000 } // give the user a chance to make it narrow again if they overshot.
		)

		window.addEventListener('resize', handler)
		return () => {
			handler.cancel()
			window.removeEventListener('resize', handler)
		}
	}, [matchRoute, navigate, showSettings])

	// Handle editing known-surfaces (aka configured surfaces)
	const selectKnownSurface = useCallback(
		(itemId: string | null) => {
			if (itemId === null || selectedItemId === itemId) {
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
		[navigate, selectedItemId]
	)

	const showPrimaryPanel = !selectedItemId && !showSettings
	const showSecondaryPanel = !!selectedItemId || showSettings

	return (
		<CRow className="surfaces-page split-panels">
			<CCol
				xs={12}
				xl={6}
				className={`primary-panel ${showPrimaryPanel ? '' : 'd-xl-flex d-none'} flex-column-layout`}
				ref={primaryPanelRef}
			>
				<div className="fixed-header">
					<h4>Configured Surfaces</h4>

					<p style={{ marginBottom: '0.5rem' }}>
						Click on any item to edit the configuration of a currently-known surface or group.
						<br />
						If your streamdeck is missing from this list, you might need to close the Elgato Streamdeck application and
						click the Rescan button below.
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

					<CButton color="info" className="d-xl-none float-end" size="sm" onClick={handleShowSettings}>
						<FontAwesomeIcon icon={faCog} /> Show Settings
					</CButton>
				</div>

				<KnownSurfacesTable selectedItemId={selectedItemId} selectItem={selectKnownSurface} />

				<div className="fixed-header">
					<CCallout color="info">
						Did you know, you can connect a Streamdeck from another computer or Raspberry Pi with{' '}
						<a target="_blank" rel="noreferrer" href="https://l.companion.free/q/YH8dZkH1Q">
							Companion Satellite
						</a>
						?
					</CCallout>
				</div>
			</CCol>

			<CCol xs={12} xl={6} className={`secondary-panel ${showSecondaryPanel ? 'd-block' : 'd-xl-block d-none'}`}>
				<div className="secondary-panel-simple">
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</CCol>
		</CRow>
	)
})
