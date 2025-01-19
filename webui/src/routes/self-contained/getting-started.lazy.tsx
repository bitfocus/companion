import { createLazyFileRoute } from '@tanstack/react-router'
import { GettingStarted } from '../../GettingStarted.js'

export const Route = createLazyFileRoute('/getting-started')({
	component: GettingStarted,
})
