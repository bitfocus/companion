import { createFileRoute } from '@tanstack/react-router'
import { ConnectionsPage } from '~/Connections/ConnectionsPage.js'

export const Route = createFileRoute('/_app/connections')({
	component: ConnectionsPage,
})
