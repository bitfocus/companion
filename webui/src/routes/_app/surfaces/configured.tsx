import { createFileRoute } from '@tanstack/react-router'
import { ConfiguredSurfacesPage } from '~/Surfaces/ConfiguredSurfacesPage'

export const Route = createFileRoute('/_app/surfaces/configured')({
	component: ConfiguredSurfacesPage,
})
