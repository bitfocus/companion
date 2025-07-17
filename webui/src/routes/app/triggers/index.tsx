import { faClock } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/triggers/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body no-scroll">
			<NonIdealState text="Select a trigger to edit" icon={faClock} />
		</div>
	)
}
