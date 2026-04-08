import { createFileRoute } from '@tanstack/react-router'
import { MainSurfacesPage } from '~/Surfaces/MainSurfacesPage'

export const Route = createFileRoute('/_app/surfaces')({
	component: MainSurfacesPage,
})
