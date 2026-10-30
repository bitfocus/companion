import { createFileRoute, Navigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { TransportEditPanel } from '~/Link/TransportEditPanel.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { link: linkStore } = useContext(RootAppStoreContext)
	const { transportId } = Route.useParams()

	const transport = linkStore.transports.get(transportId)
	if (!transport) {
		// Wait for the list to load before deciding it doesn't exist
		if (!linkStore.transportsLoaded) return null
		return <Navigate to="/link/transports" replace />
	}

	return (
		<MyErrorBoundary>
			<TransportEditPanel key={transportId} transport={transport} />
		</MyErrorBoundary>
	)
})

export const Route = createFileRoute('/_app/link_/transports/$transportId')({
	component: RouteComponent,
})
