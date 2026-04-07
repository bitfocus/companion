import { CCol, CRow, CAlert, CButtonGroup, CButton, CCallout } from '@coreui/react'
import { faSync, faAdd, faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRef, useState, useCallback } from 'react'
import { AddEmulatorModal, type AddEmulatorModalRef } from './AddEmulatorModal'
import { AddSurfaceGroupModal, type AddSurfaceGroupModalRef } from './AddGroupModal'
import { KnownSurfacesTable } from './KnownSurfacesTable'
import { MyErrorBoundary } from '~/Resources/Error'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { trpc } from '~/Resources/TRPC'
import { useMutation } from '@tanstack/react-query'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode'
import { useShowSecondaryPanel } from '~/Hooks/useShowSecondaryPanel'
import { ContextHelpButton } from '~/Layout/PanelIcons'

export const MainSurfacesPage = observer(function MainSurfacesPage(): React.JSX.Element {
	const twoPanelMode = useTwoPanelMode()

	const navigate = useNavigate()
	const matchRoute = useMatchRoute()

	const routeMatch = matchRoute({ to: '/surfaces/$itemId' })
	const selectedSurfaceId = routeMatch ? routeMatch.itemId : null

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
				setScanError('Rescanning USB devices failed! Please try again.')
			})
	}, [rescanUsbMutationAsync])

	const addEmulator = useCallback(() => {
		addEmulatorModalRef.current?.show()
	}, [])
	const addGroup = useCallback(() => {
		addGroupModalRef.current?.show()
	}, [])

	// Handle action when the user clicks the "Show Settings" button
	const handleShowSettings = useCallback(() => {
		void navigate({ to: '/surfaces/integrations' })
	}, [navigate])

	// Handle the various cases in which we want to show the secondary panel in one-panel mode
	// 1. if one of the integration subpanels are currently visible or user clicked "Show Settings"
	const showSettings = useShowSecondaryPanel({
		baseRoute: '/surfaces',
		secondaryRoute: '/surfaces/integrations',
	})

	// 2. if editing known-surfaces (aka configured surfaces)
	const selectKnownSurface = useCallback(
		(itemId: string | null) => {
			if (itemId === null || selectedSurfaceId === itemId) {
				void navigate({ to: '/surfaces' })
			} else {
				void navigate({
					to: '/surfaces/$itemId',
					params: {
						itemId: itemId,
					},
				})
			}
		},
		[navigate, selectedSurfaceId]
	)

	// the following constants determine if the panel will actually be shown (previously these only established if it was "allowed" to be shown)
	const showPrimaryPanel = twoPanelMode || (!selectedSurfaceId && !showSettings)
	const showSecondaryPanel = twoPanelMode || !!selectedSurfaceId || showSettings

	return (
		<CRow className="surfaces-page split-panels">
			<CCol
				xs={twoPanelMode ? 6 : 12}
				className={`primary-panel ${showPrimaryPanel ? 'd-flex' : 'd-none'} flex-column-layout`}
			>
				<div className="fixed-header">
					<h4 className="btn-inline">
						Configured Surfaces
						<ContextHelpButton action="/user-guide/config/surfaces" />
					</h4>

					<p style={{ marginBottom: '0.5rem' }}>
						Click on any item to edit the configuration of a currently-known surface or group.
						<br />
						If your streamdeck is missing from this list, you might need to close the Elgato Streamdeck application and
						click the Rescan button below.
					</p>

					{scanError && (
						<CAlert color="warning" role="alert">
							{scanError}
						</CAlert>
					)}

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

					{!twoPanelMode && (
						<CButton color="info" className="float-end" size="sm" onClick={handleShowSettings}>
							<FontAwesomeIcon icon={faCog} /> Show Settings
						</CButton>
					)}
				</div>

				<KnownSurfacesTable selectedItemId={selectedSurfaceId} selectItem={selectKnownSurface} />

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

			<CCol xs={twoPanelMode ? 6 : 12} className={`secondary-panel ${showSecondaryPanel ? 'd-block' : 'd-none'}`}>
				<div className="secondary-panel-simple">
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</CCol>
		</CRow>
	)
})
