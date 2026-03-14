import { createFileRoute, Navigate } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { SurfaceEditPanel } from '~/Surfaces/EditPanel.js'
import { useComputed } from '~/Resources/util.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useSurfacesSubscription } from '~/Hooks/useSurfacesSubscription'
import { CSpinner } from '@coreui/react'

const RouteComponent = observer(function RouteComponent() {
	const { surfaces } = useContext(RootAppStoreContext)
	const { itemId } = Route.useParams()
	const dataReady = useSurfacesSubscription(surfaces)

	// Determine if this is a surface or group and validate
	const itemInfo = useComputed(() => {
		if (!itemId) return null

		// Check if it's a surface
		for (const group of surfaces.store.values()) {
			if (!group) continue
			for (const surface of group.surfaces) {
				if (surface.id === itemId) {
					return { type: 'surface', surfaceId: itemId, groupId: null }
				}
			}
		}

		// Check if it's a group
		for (const group of surfaces.store.values()) {
			if (group && group.id === itemId && !group.isAutoGroup) {
				return { type: 'group', surfaceId: null, groupId: itemId }
			}
		}

		return null
	}, [itemId, surfaces])

	if (!dataReady) {
		// presumably the component will rerender when status changes.
		return (
			<div className="d-flex-col text-center m-5">
				<h1 role="status">Loading...</h1>
				<CSpinner className="ms-auto" />
			</div>
		)
	} else if (!itemInfo) {
		// Redirect if item not found
		// condition was: itemId && !itemInfo but if itemId is missing, we wouldn't reach this route: it would go to index.tsx
		return <Navigate to="/surfaces/configured" replace />
	} else {
		return (
			<MyErrorBoundary>
				<SurfaceEditPanel key={itemId} surfaceId={itemInfo.surfaceId} groupId={itemInfo.groupId} />
			</MyErrorBoundary>
		)
	}
})

export const Route = createFileRoute('/_app/surfaces/configured/$itemId')({
	component: RouteComponent,
})
