import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { ConnectionEditPanel } from '~/Connections/ConnectionEdit/ConnectionEditPanel'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { connectionId } = Route.useParams()

	const { connections } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/connections/$connectionId' })

	// Ensure the selected connection is valid
	useComputed(() => {
		if (!connections.connections.has(connectionId)) {
			void navigate({ to: `/connections` })
		}
	}, [navigate, connections, connectionId])

	return <ConnectionEditPanel key={connectionId} connectionId={connectionId} />
})

export const Route = createFileRoute('/_app/connections/$connectionId')({
	component: RouteComponent,
})
