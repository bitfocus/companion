import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/surfaces/configured/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body no-scroll">
			<NonIdealState text="Select a surface or group to configure" icon={faCog} />
		</div>
	)
}
