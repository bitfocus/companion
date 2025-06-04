import { createFileRoute } from '@tanstack/react-router'
import { TriggersPage } from '~/Triggers/index.js'

export const Route = createFileRoute('/_app/triggers')({
	component: TriggersPage,
})
