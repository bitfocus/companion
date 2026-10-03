import { createFileRoute } from '@tanstack/react-router'
import { SurfaceDiscoveryPanel } from '~/Surfaces/Discovery/SurfaceDiscoveryPanel'

export const Route = createFileRoute('/_app/surfaces_/remote/discover')({
	component: SurfaceDiscoveryPanel,
})
