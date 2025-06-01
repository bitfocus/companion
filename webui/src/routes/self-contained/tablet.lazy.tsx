import { createLazyFileRoute } from '@tanstack/react-router'
import { TabletView } from '~/TabletView/index.js'

export const Route = createLazyFileRoute('/tablet')({
	component: TabletView,
})
