import { createFileRoute } from '@tanstack/react-router'
import { RemoteSurfacesPage } from '~/Surfaces/Remote/RemoteSurfacesPage.js'

export const Route = createFileRoute('/_app/surfaces/remote')({
	component: RemoteSurfacesPage,
})
