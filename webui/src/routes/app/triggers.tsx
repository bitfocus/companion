import { createFileRoute } from '@tanstack/react-router'
import { TriggersPage } from '~/Triggers/Page.js'

export const Route = createFileRoute('/_app/triggers')({
	component: TriggersPage,
})
