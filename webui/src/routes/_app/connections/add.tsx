import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connections/add')({
	component: RouteComponent,
})

/**
 * Intentionally renders nothing: ConnectionsPage matches this route (`matchRoute`) to decide whether
 * to show the add panel in its secondary column, so the route only needs to exist.
 */
function RouteComponent() {
	return null
}
