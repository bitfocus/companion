import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/tablet.html')({
	loader: () => {
		throw redirect({
			to: '/tablet',
		})
	},
})
