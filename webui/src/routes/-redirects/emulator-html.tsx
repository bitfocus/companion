import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/emulator.html')({
	loader: () => {
		throw redirect({
			to: '/emulator',
		})
	},
})
