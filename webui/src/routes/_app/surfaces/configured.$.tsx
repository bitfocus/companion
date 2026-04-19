import { createFileRoute, redirect } from '@tanstack/react-router'

// for backwards compatibility
export const Route = createFileRoute('/_app/surfaces/configured/$')({
	loader: () => {
		throw redirect({ to: '/surfaces', statusCode: 301 })
	},
})
