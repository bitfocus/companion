import { createFileRoute } from '@tanstack/react-router'
import { SurfacesPage } from '../../Surfaces/index.js'

export const Route = createFileRoute('/_app/surfaces')({
	component: SurfacesPage,
})
