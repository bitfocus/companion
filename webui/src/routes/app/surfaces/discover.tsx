import { createFileRoute } from '@tanstack/react-router'
import { DiscoverSurfacesPage } from '~/Surfaces/DiscoverSurfacesPage'

export const Route = createFileRoute('/_app/surfaces/discover')({
	component: DiscoverSurfacesPage,
})
