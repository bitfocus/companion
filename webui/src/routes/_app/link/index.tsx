import { createFileRoute } from '@tanstack/react-router'
import { LinkOverviewPanel } from '~/Link/LinkOverviewPanel.js'

export const Route = createFileRoute('/_app/link/')({
	component: LinkOverviewPanel,
})
