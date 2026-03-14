import { createFileRoute, retainSearchParams } from '@tanstack/react-router'
import { ConfiguredSurfacesPage } from '~/Surfaces/ConfiguredSurfacesPage'

interface SurfacesStateProps {
	showSettings?: boolean
}

export const Route = createFileRoute('/_app/surfaces/configured')({
	// note: doing this with zod/zodValidator forced the search term to appear in the URL even if not specified.
	// as a bonus, we don't need to add the package "@tanstack/zod-adapter"
	validateSearch: (search: Record<string, unknown>): SurfacesStateProps =>
		search?.showSettings !== undefined ? { showSettings: !!search.showSettings } : {},
	search: {
		middlewares: [retainSearchParams(['showSettings'])],
	},
	component: ConfiguredSurfacesPage,
})
