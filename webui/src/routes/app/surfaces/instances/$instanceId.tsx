import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faCog } from '@fortawesome/free-solid-svg-icons'

export const Route = createFileRoute('/_app/surfaces/instances/$instanceId')({
	component: ModuleConfigComponent,
})

function ModuleConfigComponent() {
	const { instanceId } = Route.useParams()

	return (
		<div className="surface-instance-config">
			<h4>Configure Surface Instance: {instanceId}</h4>
			<NonIdealState icon={faCog} text="Surface instance configuration interface coming soon." />
		</div>
	)
}
