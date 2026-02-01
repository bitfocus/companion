import { createFileRoute, redirect } from '@tanstack/react-router'
import React from 'react'

export const Route = createFileRoute('/_app/variables/$oldLabel')({
	component: RouteComponent,
	loader: async ({ params }) => {
		if (params.oldLabel === 'connection') {
			throw redirect({
				to: `/variables`,
			})
		}
		throw redirect({
			to: `/variables/connection/$label`,
			params: { label: params.oldLabel },
		})
	},
})

function RouteComponent() {
	return <div></div>
}
