import { createFileRoute } from '@tanstack/react-router'
import { SurfaceInstancesPage } from '~/Surfaces/Instances/SurfaceInstancesPage.js'

export const Route = createFileRoute('/_app/surfaces/instances')({
	component: SurfaceInstancesPage,
})
