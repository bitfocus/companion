import { createFileRoute } from '@tanstack/react-router'
import { ConnectionsPage } from '~/Connections/index.js'

export const Route = createFileRoute('/_app/connections')({
	component: ConnectionsPage,
})
