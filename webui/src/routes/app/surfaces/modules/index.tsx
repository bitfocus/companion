import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'

export const Route = createFileRoute('/_app/surfaces/modules/')({
	component: InstancesIndexComponent,
})

function InstancesIndexComponent() {
	return (
		<NonIdealState
			icon={faLayerGroup}
			text="Select a surface instance from the list to configure it, or add a new one."
		/>
	)
}
