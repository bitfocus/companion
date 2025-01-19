import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/tablet2.html')({
	loader: () => {
		throw redirect({
			to: '/tablet',
		})
	},
})
