import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/getting-started')({
	loader: () => {
		throw redirect({
			href: '/user-guide/',
			reloadDocument: true,
		})
	},
})
