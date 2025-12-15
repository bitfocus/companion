import { createFileRoute, Link } from '@tanstack/react-router'
import React from 'react'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/surfaces/configured/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body no-scroll">
			<NonIdealState text="Select a surface or group to configure" icon={faCog}>
				<p className="mb-1 mt-4">
					<strong>Companion supports many different types of surfaces.</strong>
				</p>
				<p className="mb-0">
					You can enable support for them on the{' '}
					<Link to="/surfaces/instances" className="text-decoration-none">
						surface instances page
					</Link>
					.
				</p>
			</NonIdealState>
		</div>
	)
}
