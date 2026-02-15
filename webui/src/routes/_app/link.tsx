import { createFileRoute } from '@tanstack/react-router'
import { LinkPage } from '~/Link/index.js'

export const Route = createFileRoute('/_app/link')({
	component: LinkPage,
})
