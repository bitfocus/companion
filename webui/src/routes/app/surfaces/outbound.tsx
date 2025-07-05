import { createFileRoute } from '@tanstack/react-router'
import { OutboundSurfacesPage } from '~/Surfaces/OutboundSurfacesPage.js'

export const Route = createFileRoute('/_app/surfaces/outbound')({
	component: OutboundSurfacesPage,
})
