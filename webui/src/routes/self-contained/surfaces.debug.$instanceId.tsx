import { createFileRoute } from '@tanstack/react-router'
import { SurfaceInstanceDebug } from '~/Surfaces/Instances/SurfaceInstanceDebug'

export const Route = createFileRoute('/surfaces/debug/$instanceId')({
	component: SurfaceInstanceDebug,
})
