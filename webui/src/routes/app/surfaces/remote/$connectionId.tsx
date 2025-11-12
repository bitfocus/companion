import { createFileRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import React, { useContext } from 'react'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { RemoteSurfaceEditPanel } from '~/Surfaces/Remote/EditPanel'

const RouteComponent = observer(function RouteComponent() {
	const { surfaces } = useContext(RootAppStoreContext)
	const { connectionId } = Route.useParams()

	const navigate = Route.useNavigate()

	// Determine if this is a surface or group and validate
	const remoteInfo = useComputed(() => {
		if (!connectionId) return null

		// Check if it's a surface
		for (const remoteInfo of surfaces.outboundSurfaces.values()) {
			if (!remoteInfo) continue
			if (remoteInfo.id === connectionId) {
				return remoteInfo
			}
		}

		return null
	}, [connectionId, surfaces])

	// Redirect if item not found
	useComputed(() => {
		if (connectionId && !remoteInfo) {
			void navigate({ to: `/surfaces/remote` })
		}
	}, [navigate, connectionId, remoteInfo])

	if (!remoteInfo) {
		return null
	}

	return (
		<MyErrorBoundary>
			<RemoteSurfaceEditPanel key={connectionId} remoteInfo={remoteInfo} />
		</MyErrorBoundary>
	)
})

export const Route = createFileRoute('/_app/surfaces/remote/$connectionId')({
	component: RouteComponent,
})
