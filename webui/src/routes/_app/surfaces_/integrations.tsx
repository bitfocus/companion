import { createFileRoute } from '@tanstack/react-router'
import { SurfaceIntegrationsPage } from '~/Surfaces/Instances/SurfaceIntegrationsPage.js'

export const Route = createFileRoute('/_app/surfaces_/integrations')({
	component: SurfaceIntegrationsPage,
})
