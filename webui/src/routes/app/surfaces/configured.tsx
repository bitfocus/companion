import { createFileRoute } from '@tanstack/react-router'
import { ConfiguredSurfacesTab } from '~/Surfaces/index.js'

export const Route = createFileRoute('/_app/surfaces/configured')({
	component: ConfiguredSurfacesTab,
})
