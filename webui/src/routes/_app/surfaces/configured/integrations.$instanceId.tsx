import React, { useContext } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { SurfaceInstanceEditPanel } from '~/Surfaces/Instances/SurfaceInstanceEdit/SurfaceInstanceEditPanel'
import { observer } from 'mobx-react-lite'

const ModuleConfigComponent = observer(function ModuleConfigComponent() {
	const { instanceId } = Route.useParams()
	const { surfaceInstances } = useContext(RootAppStoreContext)

	// Ensure the selected instance is valid
	// note: Currently Companion displays a "loading" bar until surfaceInstances have been loaded, so we don't test for "data is ready"
	if (!surfaceInstances.instances.has(instanceId)) {
		return <Navigate to="/surfaces/configured/integrations" replace />
	} else {
		return <SurfaceInstanceEditPanel key={instanceId} instanceId={instanceId} />
	}
})

export const Route = createFileRoute('/_app/surfaces/configured/integrations/$instanceId')({
	component: ModuleConfigComponent,
})
