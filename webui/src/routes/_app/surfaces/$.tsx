import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/surfaces/$')({
	loader: () => {
		throw redirect({ to: '/surfaces/configured' })
	},
})
