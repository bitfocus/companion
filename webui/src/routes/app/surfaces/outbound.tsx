import { createFileRoute } from '@tanstack/react-router'
import { OutboundSurfacesTab } from '../../../Surfaces/index.js'

export const Route = createFileRoute('/_app/surfaces/outbound')({
	component: OutboundSurfacesTab,
})
