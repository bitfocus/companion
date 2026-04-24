import { createFileRoute, Navigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { RemoteSurfaceEditPanel } from '~/Surfaces/Remote/EditPanel'

const RouteComponent = observer(function RouteComponent() {
	const { surfaces } = useContext(RootAppStoreContext)
	const { connectionId } = Route.useParams()

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

	if (!remoteInfo) {
		// Redirect if item not found or not provided
		return <Navigate to="/surfaces/remote" replace />
	} else {
		return (
			<MyErrorBoundary>
				<RemoteSurfaceEditPanel key={connectionId} remoteInfo={remoteInfo} />
			</MyErrorBoundary>
		)
	}
})

export const Route = createFileRoute('/_app/surfaces_/remote/$connectionId')({
	component: RouteComponent,
})
