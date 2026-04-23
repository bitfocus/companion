import { createFileRoute } from '@tanstack/react-router'
import { RemoteSurfacesPage } from '~/Surfaces/Remote/RemoteSurfacesPage.js'

export const Route = createFileRoute('/_app/surfaces_/remote')({
	component: RemoteSurfacesPage,
})
