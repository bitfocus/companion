import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/surfaces/discover')({
	loader: () => {
		throw redirect({ to: '/surfaces/remote' })
	},
})
