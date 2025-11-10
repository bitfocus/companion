import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/help.html')({
	loader: () => {
		throw redirect({
			href: '/user-guide',
			reloadDocument: true,
		})
	},
})
