import { faAdd, faBook, faPlug } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { Button, LinkButtonExternal } from '~/Components/Button.js'
import { Modal } from '~/Components/Modal.js'
import { AddConnectionsPanel } from '~/Connections/AddConnectionPanel.js'
import { useEscapeToClose } from '~/Hooks/useEscapeToClose.js'
import type { PageEmptyStateProps } from '~/Layout/PageEmptyState.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ConnectionsList } from './ConnectionList/ConnectionList.js'

const connectionsHelpPage = '/user-guide/config/connections'

export const ConnectionsPage = observer(function ConnectionsPage(): React.JSX.Element {
	const navigate = useNavigate()
	const matchRoute = useMatchRoute()
	const addConnectionsMatch = !!matchRoute({ to: '/connections/add' })
	const routeMatch = matchRoute({ to: '/connections/$connectionId', fuzzy: true })
	const selectedConnectionId = routeMatch && routeMatch.connectionId !== 'add' ? routeMatch.connectionId : null

	const handleCloseModal = useCallback(() => {
		void navigate({ to: '/connections' })
	}, [navigate])

	// Close configuration panel on Escape key
	useEscapeToClose(!!selectedConnectionId && !addConnectionsMatch, handleCloseModal)

	const { connections } = useContext(RootAppStoreContext)
	const empty: PageEmptyStateProps | null =
		connections.count === 0 && connections.collections.size === 0 && !selectedConnectionId
			? {
					icon: faPlug,
					title: 'No connections yet',
					description: (
						<>
							<p>
								Connections link Companion to the devices and software you want to control: video switchers, audio
								consoles, media players, lighting desks, PTZ cameras and many more.
							</p>
							<p>Each one gives you actions to put on your buttons, and feedbacks and variables to show their state.</p>
						</>
					),
					actions: (
						<>
							<Button color="primary" onClick={() => void navigate({ to: '/connections/add' })}>
								<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add your first connection
							</Button>
							<LinkButtonExternal color="secondary" href={makeAbsolutePath(connectionsHelpPage)}>
								<FontAwesomeIcon icon={faBook} className="me-1.5" /> Read the guide
							</LinkButtonExternal>
						</>
					),
				}
			: null

	return (
		<div className="page-shell">
			<PageHeader icon={faPlug} title="Connections" helpAction={connectionsHelpPage} />

			<SplitPanels.Root
				empty={empty}
				showing={selectedConnectionId ? 'secondary' : 'primary'}
				resize={{ storageKey: 'connections' }}
			>
				<SplitPanels.Primary className="overflow-hidden">
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
						<Modal.Popup size="lg" scrollable>
							<Modal.Header closeButton>
								<Modal.Title>Add Connection</Modal.Title>
							</Modal.Header>
							<Modal.Body className="flex flex-col overflow-hidden">
								<MyErrorBoundary>
									<AddConnectionsPanel />
								</MyErrorBoundary>
							</Modal.Body>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		</div>
	)
})
