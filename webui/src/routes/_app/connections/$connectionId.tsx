import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { ConnectionEditPanel } from '~/Connections/ConnectionEdit/ConnectionEditPanel'
import {
	validateConnectionEditSearch,
	type ConnectionEditTab,
} from '~/Connections/ConnectionEdit/connectionEditTabs.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { connectionId } = Route.useParams()
	const { tab } = Route.useSearch()

	const { connections } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/connections/$connectionId' })

	// Ensure the selected connection is valid
	useComputed(() => {
		if (!connections.connections.has(connectionId)) {
			void navigate({ to: `/connections` })
		}
	}, [navigate, connections, connectionId])

	const setActiveTab = (nextTab: ConnectionEditTab) => {
		void navigate({
			to: '/connections/$connectionId',
			params: { connectionId },
			search: nextTab === 'settings' ? {} : { tab: nextTab },
		})
	}

	return (
		<ConnectionEditPanel
			key={connectionId}
			connectionId={connectionId}
			activeTab={tab ?? 'settings'}
			setActiveTab={setActiveTab}
		/>
	)
})

export const Route = createFileRoute('/_app/connections/$connectionId')({
	validateSearch: validateConnectionEditSearch,
	component: RouteComponent,
})
