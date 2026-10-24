import { createFileRoute, Navigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { LinkPeerPanel } from '~/Link/LinkPeerPanel.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { link: linkStore } = useContext(RootAppStoreContext)
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
