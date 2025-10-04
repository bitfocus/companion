import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/modules')({
	loader: () => {
		throw redirect({ to: '/connections/modules' })
	},
})
