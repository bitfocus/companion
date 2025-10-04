import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connections/$')({
	loader: () => {
		throw redirect({ to: '/connections/configured' })
	},
})
