import { createFileRoute, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { ConnectionEditPanel } from '~/Connections/ConnectionEdit/ConnectionEditPanel'
import { CONNECTION_EDIT_TAB_PATHS, type ConnectionEditTab } from '~/Connections/ConnectionEdit/connectionEditTabs.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { connectionId } = Route.useParams()
	const matchRoute = useMatchRoute()
	const activeTab: ConnectionEditTab = matchRoute({ to: CONNECTION_EDIT_TAB_PATHS.docs })
		? 'docs'
		: matchRoute({ to: CONNECTION_EDIT_TAB_PATHS.diagnostics })
			? 'diagnostics'
			: 'settings'

	const { connections } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/connections/$connectionId' })

	// Ensure the selected connection is valid
	useComputed(() => {
		if (!connections.connections.has(connectionId)) {
			void navigate({ to: `/connections` })
		}
	}, [navigate, connections, connectionId])

	const setActiveTab = (nextTab: ConnectionEditTab) => {
		void navigate({ to: CONNECTION_EDIT_TAB_PATHS[nextTab], params: { connectionId } })
	}

	return (
		<ConnectionEditPanel
			key={connectionId}
			connectionId={connectionId}
			activeTab={activeTab}
			setActiveTab={setActiveTab}
		/>
	)
})

export const Route = createFileRoute('/_app/connections/$connectionId')({
	component: RouteComponent,
})
