import { faCubesStacked } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/custom-feedbacks/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faCubesStacked}
			title="Select a custom feedback"
			description="Choose a custom feedback from the list to edit its inputs and feedbacks."
		/>
	)
}
