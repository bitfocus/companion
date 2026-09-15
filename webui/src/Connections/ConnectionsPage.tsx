import { faPlug } from '@fortawesome/free-solid-svg-icons'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useEffect } from 'react'
import { Modal } from '~/Components/Modal.js'
import { AddConnectionsPanel } from '~/Connections/AddConnectionPanel.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ConnectionsList } from './ConnectionList/ConnectionList.js'

export const ConnectionsPage = observer(function ConnectionsPage(): React.JSX.Element {
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()
	const addConnectionsMatch = !!matchRoute({ to: '/connections/add' })
	const routeMatch = matchRoute({ to: '/connections/$connectionId' })
	const selectedConnectionId = routeMatch && routeMatch.connectionId !== 'add' ? routeMatch.connectionId : null

	const handleCloseModal = useCallback(() => {
		void navigate({ to: '/connections' })
	}, [navigate])

	// Close configuration panel on Escape key
	useEffect(() => {
		if (!selectedConnectionId) return

		const handleKeyDown = (e: KeyboardEvent) => {
			// Let focused controls and dialogs consume Escape without also discarding the editor.
			const target = e.target instanceof Element ? e.target : null
			if (
				e.defaultPrevented ||
				addConnectionsMatch ||
				document.querySelector('[role="dialog"]') ||
				target?.closest('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="combobox"]')
			)
				return
			if (e.key === 'Escape') {
				void navigate({ to: '/connections' })
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [selectedConnectionId, addConnectionsMatch, navigate])

	return (
		<div className="page-shell">
			<PageHeader icon={faPlug} title="Connections" helpAction="/user-guide/config/connections" />

			<SplitPanels.Root showing={selectedConnectionId ? 'secondary' : 'primary'} resize={{ storageKey: 'connections' }}>
				<SplitPanels.Primary>
					<ConnectionsList selectedConnectionId={selectedConnectionId} />
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
				open={addConnectionsMatch}
				onOpenChange={(open) => {
					if (!open) handleCloseModal()
				}}
			>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup size="xl" scrollable>
							<Modal.Header closeButton>
								<Modal.Title>Add Connection</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<MyErrorBoundary>
									<AddConnectionsPanel isModal={true} />
								</MyErrorBoundary>
							</Modal.Body>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		</div>
	)
})
