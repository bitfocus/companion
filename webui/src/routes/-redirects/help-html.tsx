import { createFileRoute, redirect } from '@tanstack/react-router'
import { makeAbsolutePath } from '~/Resources/util.js'

export const Route = createFileRoute('/help.html')({
	loader: () => {
		throw redirect({
			href: makeAbsolutePath('/user-guide/'),
			reloadDocument: true,
		})
	},
})
