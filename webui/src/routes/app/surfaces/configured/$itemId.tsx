import { createFileRoute } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { SurfaceEditPanel } from '~/Surfaces/EditPanel.js'
import { MyErrorBoundary, useComputed } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { surfaces } = useContext(RootAppStoreContext)
	const { itemId } = Route.useParams()

	const navigate = Route.useNavigate()

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

	// Redirect if item not found
	useComputed(() => {
		if (itemId && !itemInfo) {
			void navigate({ to: `/surfaces/configured` })
		}
	}, [navigate, itemId, itemInfo])

	if (!itemInfo) {
		return null
	}

	return (
		<MyErrorBoundary>
			<SurfaceEditPanel key={itemId} surfaceId={itemInfo.surfaceId} groupId={itemInfo.groupId} />
		</MyErrorBoundary>
	)
})

export const Route = createFileRoute('/_app/surfaces/configured/$itemId')({
	component: RouteComponent,
})
