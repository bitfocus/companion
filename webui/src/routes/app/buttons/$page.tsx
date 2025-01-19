import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/buttons/$page')({
	component: RouteComponent,
})

function RouteComponent() {
	return null
}
