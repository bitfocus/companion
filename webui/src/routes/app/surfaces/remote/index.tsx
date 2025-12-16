import { createFileRoute } from '@tanstack/react-router'
import { SurfaceDiscoveryPage } from '~/Surfaces/Discovery/SurfaceDiscoveryPage'

export const Route = createFileRoute('/_app/surfaces/remote/')({
	component: SurfaceDiscoveryPage,
})
