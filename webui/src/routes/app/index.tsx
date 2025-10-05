import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
	loader: () => {
		throw redirect({ to: '/connections/configured' })
	},
})
