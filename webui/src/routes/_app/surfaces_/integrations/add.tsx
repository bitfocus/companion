import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/surfaces_/integrations/add')({
	component: RouteComponent,
})

/**
 * Intentionally renders nothing: SurfaceIntegrationsPage matches this route (`matchRoute`) to decide
 * whether to show the add modal, so the route only needs to exist.
 */
function RouteComponent() {
	return null
}
