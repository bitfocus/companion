import { faClock } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/triggers/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faClock}
			title="Select a trigger"
			description="Choose a trigger from the list to edit its events, conditions and actions."
		/>
	)
}
