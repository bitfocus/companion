import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '../../../../Components/NonIdealState.js'

export const Route = createFileRoute('/_app/settings/backups/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body no-scroll">
			<NonIdealState text="Select a backup rule to edit" icon={faCalendarAlt} />
		</div>
	)
}
