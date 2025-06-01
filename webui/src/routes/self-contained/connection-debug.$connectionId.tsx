import { createFileRoute } from '@tanstack/react-router'
import { ConnectionDebug } from '~/ConnectionDebug.js'

export const Route = createFileRoute('/connection-debug/$connectionId')({
	component: ConnectionDebug,
})
