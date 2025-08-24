import { faDollarSign } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/variables/computed/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple">
			<div className="secondary-panel-simple-body no-scroll">
				<NonIdealState text="Select a computed variable to edit" icon={faDollarSign} />
			</div>
		</div>
	)
}
