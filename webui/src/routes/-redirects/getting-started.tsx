import { createFileRoute, redirect } from '@tanstack/react-router'
import { makeAbsolutePath } from '~/Resources/util.js'

export const Route = createFileRoute('/getting-started')({
	loader: () => {
		throw redirect({
			href: makeAbsolutePath('/user-guide/'),
			reloadDocument: true,
		})
	},
})
