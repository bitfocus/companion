import { faGamepad } from '@fortawesome/free-solid-svg-icons'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { Modal } from '~/Components/Modal.js'
import { PageHeader } from '~/Layout/PageHeader'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { SurfacesNav } from '../SurfacesNav.js'
import { AddSurfaceInstancePanel } from './AddSurfaceInstancePanel.js'
import { SurfaceInstancesList } from './SurfaceInstanceList/SurfaceInstanceList.js'

export const SurfaceIntegrationsPage = observer(function SurfaceIntegrationsPage(): React.JSX.Element {
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()
	const addMatch = !!matchRoute({ to: '/surfaces/integrations/add' })
	const instanceMatch = matchRoute({ to: '/surfaces/integrations/$instanceId' })
	const selectedInstanceId = instanceMatch && instanceMatch.instanceId !== 'add' ? instanceMatch.instanceId : null

	const handleCloseModal = useCallback(() => {
		void navigate({ to: '/surfaces/integrations' })
	}, [navigate])

	return (
		<div className="page-shell">
			<PageHeader icon={faGamepad} title="Surfaces" helpAction="/user-guide/config/surfaces#integrations" />

			<SurfacesNav />

			<SplitPanels.Root
				showing={selectedInstanceId ? 'secondary' : 'primary'}
				resize={{ storageKey: 'surfaces-integrations' }}
			>
				<SplitPanels.Primary>
					<MyErrorBoundary>
						<SurfaceInstancesList selectedInstanceId={selectedInstanceId} />
					</MyErrorBoundary>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						<MyErrorBoundary>
							<Outlet />
						</MyErrorBoundary>
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>

			<Modal.Root
				open={addMatch}
				onOpenChange={(open) => {
					if (!open) handleCloseModal()
				}}
			>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup size="xl" scrollable>
							<Modal.Header closeButton>
								<Modal.Title>Add Surface Integration</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<MyErrorBoundary>
									<AddSurfaceInstancePanel />
								</MyErrorBoundary>
							</Modal.Body>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		</div>
	)
})
