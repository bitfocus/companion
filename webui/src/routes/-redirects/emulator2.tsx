import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/emulator2')({
	loader: () => {
		throw redirect({
			to: '/emulator',
		})
	},
})
