import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/help.html')({
	loader: () => {
		throw redirect({
			to: '/getting-started',
		})
	},
})
