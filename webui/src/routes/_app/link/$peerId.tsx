import { createFileRoute, Navigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { LinkPeerPanel } from '~/Link/LinkPeerPanel.js'
import { useLinkStore } from '~/Link/LinkStoreContext.js'
import { MyErrorBoundary } from '~/Resources/Error.js'

const RouteComponent = observer(function RouteComponent() {
	const linkStore = useLinkStore()
	const { peerId } = Route.useParams()

	const peer = linkStore.peers.find((p) => p.id === peerId)
	if (!peer) {
		// Wait for the list to load before deciding it doesn't exist
		if (!linkStore.peersLoaded) return null
		return <Navigate to="/link" replace />
	}

	return (
		<MyErrorBoundary>
			<LinkPeerPanel key={peerId} peer={peer} />
		</MyErrorBoundary>
	)
})

export const Route = createFileRoute('/_app/link/$peerId')({
	component: RouteComponent,
})
