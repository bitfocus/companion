import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faCog } from '@fortawesome/free-solid-svg-icons'

export const Route = createFileRoute('/_app/surfaces/modules/$moduleId')({
	component: ModuleConfigComponent,
})

function ModuleConfigComponent() {
	const { moduleId } = Route.useParams()

	return (
		<div className="surface-instance-config">
			<h4>Configure Surface Instance: {moduleId}</h4>
			<NonIdealState icon={faCog} text="Surface instance configuration interface coming soon." />
		</div>
	)
}
