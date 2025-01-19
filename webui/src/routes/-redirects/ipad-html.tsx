import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/ipad.html')({
	loader: () => {
		throw redirect({
			to: '/tablet',
		})
	},
})
