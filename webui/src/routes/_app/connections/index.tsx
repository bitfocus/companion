import { createFileRoute } from '@tanstack/react-router'
import { AddConnectionsPanel } from '~/Connections/AddConnectionPanel'

export const Route = createFileRoute('/_app/connections/')({
	component: RouteComponent,
})

function RouteComponent() {
	return <AddConnectionsPanel />
}
