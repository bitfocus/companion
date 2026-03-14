import React, { useContext } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { SurfaceInstanceEditPanel } from '~/Surfaces/Instances/SurfaceInstanceEdit/SurfaceInstanceEditPanel'
import { observer } from 'mobx-react-lite'
import { useSurfaceInstancesSubscription } from '~/Hooks/useSurfaceInstancesSubscription'

const ModuleConfigComponent = observer(function ModuleConfigComponent() {
	const { instanceId } = Route.useParams()
	const { surfaceInstances } = useContext(RootAppStoreContext)
	const dataReady = useSurfaceInstancesSubscription(surfaceInstances)

	// Ensure the selected instance is valid
	// note: the dataReady test is more of a future-proofing. Currently Companion displays a "loading" bar until dataReady is true
	if (dataReady && !surfaceInstances.instances.has(instanceId)) {
		return <Navigate to="/surfaces/configured" replace />
	} else {
		return <SurfaceInstanceEditPanel key={instanceId} instanceId={instanceId} />
	}
})

export const Route = createFileRoute('/_app/surfaces/configured/integrations/$instanceId')({
	component: ModuleConfigComponent,
})
