import { createFileRoute, Navigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useLinkStore } from '~/Link/LinkStoreContext.js'
import { TransportEditPanel } from '~/Link/TransportEditPanel.js'
import { MyErrorBoundary } from '~/Resources/Error.js'

const RouteComponent = observer(function RouteComponent() {
	const linkStore = useLinkStore()
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
