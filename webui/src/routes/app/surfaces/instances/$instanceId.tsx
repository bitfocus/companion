import React, { useContext } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { useComputed } from '~/Resources/util'
import { SurfaceInstanceEditPanel } from '~/Surfaces/Instances/SurfaceInstanceEdit/SurfaceInstanceEditPanel'

export const Route = createFileRoute('/_app/surfaces/instances/$instanceId')({
	component: ModuleConfigComponent,
})

function ModuleConfigComponent() {
	const { instanceId } = Route.useParams()

	const { surfaceInstances } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/surfaces/instances/$instanceId' })

	// Ensure the selected instance is valid
	useComputed(() => {
		if (!surfaceInstances.instances.has(instanceId)) {
			void navigate({ to: `/surfaces/instances` })
		}
	}, [navigate, surfaceInstances, instanceId])

	return <SurfaceInstanceEditPanel key={instanceId} instanceId={instanceId} />
}
