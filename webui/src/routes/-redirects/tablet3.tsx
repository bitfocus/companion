import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/tablet3')({
	loader: () => {
		throw redirect({
			to: '/tablet',
		})
	},
})
