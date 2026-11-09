import { createFileRoute } from '@tanstack/react-router'
import { LinkInstallationsPage } from '~/Link/LinkInstallationsPage.js'

export const Route = createFileRoute('/_app/link')({
	component: LinkInstallationsPage,
})
