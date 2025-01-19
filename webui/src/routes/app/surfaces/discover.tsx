import { createFileRoute } from '@tanstack/react-router'
import { DiscoverSurfacesTab } from '../../../Surfaces/index.js'

export const Route = createFileRoute('/_app/surfaces/discover')({
	component: DiscoverSurfacesTab,
})
