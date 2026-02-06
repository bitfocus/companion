import { createFileRoute } from '@tanstack/react-router'
import { ConnectionDebug } from '~/Connections/ConnectionDebug.js'

export const Route = createFileRoute('/_standalone/connection-debug/$connectionId')({
	component: ConnectionDebug,
})
