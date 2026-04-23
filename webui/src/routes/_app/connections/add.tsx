import { createFileRoute } from '@tanstack/react-router'
import { AddConnectionsPanel } from '~/Connections/AddConnectionPanel'

export const Route = createFileRoute('/_app/connections/add')({
	component: RouteComponent,
})

function RouteComponent() {
	return <AddConnectionsPanel />
}
