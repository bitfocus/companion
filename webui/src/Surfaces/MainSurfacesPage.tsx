import { faAdd, faGamepad, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMutation } from '@tanstack/react-query'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { StaticAlert } from '~/Components/Alert'
import { Button } from '~/Components/Button'
import type { PageEmptyStateProps } from '~/Layout/PageEmptyState.js'
import { PageHeader } from '~/Layout/PageHeader'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { trpc } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { AddEmulatorModal, type AddEmulatorModalRef } from './AddEmulatorModal'
import { AddSurfaceGroupModal, type AddSurfaceGroupModalRef } from './AddGroupModal'
import { KnownSurfacesTable } from './KnownSurfacesTable'
import { SurfacesNav } from './SurfacesNav'
import { UdevRulesAlert } from './UdevRulesAlert'
import { UsbUnavailableNote } from './UsbUnavailableNote'

export const MainSurfacesPage = observer(function MainSurfacesPage(): React.JSX.Element {
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

		rescanUsbMutationAsync()
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

	const { surfaces } = useContext(RootAppStoreContext)
	const notices = (
		<>
			{scanError && (
				<StaticAlert color="warning" role="alert">
					{scanError}
				</StaticAlert>
			)}

			<UsbUnavailableNote />

			<UdevRulesAlert />
		</>
	)

	const empty: PageEmptyStateProps | null =
		surfaces.store.size === 0 && !selectedSurfaceId
			? {
					icon: faGamepad,
					title: 'No surfaces yet',
					description: (
						<>
							<p>
								Surfaces are the hardware and software you press buttons on: Stream Decks and other USB control panels,
								tablets and phones, or the emulator in your browser.
							</p>
							<p>
								Supported USB surfaces appear here as soon as they are plugged in. To try Companion without any
								hardware, add an emulator.
							</p>
						</>
					),
					actions: (
						<>
							<Button color="primary" onClick={addEmulator}>
								<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add an emulator
							</Button>
							<Button color="secondary" onClick={refreshUSB}>
								<FontAwesomeIcon icon={faSync} spin={rescanUsbMutation.isPending} className="me-1.5" />
								{rescanUsbMutation.isPending ? 'Rescanning USB...' : 'Rescan USB'}
							</Button>
						</>
					),
					notices,
				}
			: null

	return (
		<div className="page-shell">
			<PageHeader icon={faGamepad} title="Surfaces" helpAction="/user-guide/config/surfaces" />

			<SurfacesNav />

			<AddSurfaceGroupModal ref={addGroupModalRef} />
			<AddEmulatorModal ref={addEmulatorModalRef} />

			<SplitPanels.Root
				empty={empty}
				showing={selectedSurfaceId ? 'secondary' : 'primary'}
				resize={{ storageKey: 'surfaces' }}
			>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2.5 w-full">
						{notices}

						{/* Top Header Card: Actions & Rescan */}
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex items-center justify-between gap-2 flex-wrap shrink-0">
							<div className="flex flex-wrap items-center gap-2">
								<Button color="secondary" size="sm" onClick={refreshUSB}>
									<FontAwesomeIcon icon={faSync} spin={rescanUsbMutation.isPending} className="me-1.5" />
									{rescanUsbMutation.isPending ? 'Rescanning USB...' : 'Rescan USB'}
								</Button>
								<Button color="secondary" size="sm" onClick={addEmulator}>
									<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add Emulator
								</Button>
								<Button color="secondary" size="sm" onClick={addGroup}>
									<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add Group
								</Button>
							</div>
						</div>

						{/* Surfaces Table Container */}
						<div className="flex-1 min-h-0 scrollable-container list-card">
							<KnownSurfacesTable selectedItemId={selectedSurfaceId} selectItem={selectKnownSurface} />
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						<MyErrorBoundary>
							<Outlet />
						</MyErrorBoundary>
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})
