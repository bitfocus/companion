import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connections/$connectionId')({
	component: RouteComponent,
})

function RouteComponent() {
	return null
}
