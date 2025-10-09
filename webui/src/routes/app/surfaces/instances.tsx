import { createFileRoute } from '@tanstack/react-router'
import { SurfaceInstancesPage } from '~/Surfaces/SurfaceModulesPage'

export const Route = createFileRoute('/_app/surfaces/instances')({
	component: SurfaceInstancesPage,
})
