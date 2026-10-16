import { createFileRoute } from '@tanstack/react-router'
import { LinkTransportsPage } from '~/Link/LinkTransportsPage.js'

export const Route = createFileRoute('/_app/link_/transports')({
	component: LinkTransportsPage,
})
