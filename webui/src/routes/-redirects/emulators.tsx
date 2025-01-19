import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/emulators')({
	loader: () => {
		throw redirect({
			to: '/emulator',
		})
	},
})
