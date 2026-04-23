import { createFileRoute, Navigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { SurfaceEditPanel } from '~/Surfaces/EditPanel.js'

/**
 * /surfaces/$itemId - editing a configured surface
 */
const RouteComponent = observer(function RouteComponent() {
	const { surfaces } = useContext(RootAppStoreContext)
	const { itemId } = Route.useParams()

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

	if (!itemInfo) {
		// Redirect if itemId is not valid
		// condition was: itemId && !itemInfo, but if itemId is missing the route index.tsx absorbs it
		return <Navigate to="/surfaces" replace />
	} else {
		// note: if data isn't ready SurfaceEditPanel will indicate it...
		// but in truth we'd never get here in that case because Companion displays a "loading" bar until data is ready.
		return (
			<MyErrorBoundary>
				<SurfaceEditPanel key={itemId} surfaceId={itemInfo.surfaceId ?? null} groupId={itemInfo.groupId ?? null} />
			</MyErrorBoundary>
		)
	}
})

export const Route = createFileRoute('/_app/surfaces/$itemId')({
	component: RouteComponent,
})
