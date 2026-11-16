import { faShapes } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/custom-elements/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faShapes}
			title="Select a custom element"
			description="Choose a custom element from the list to edit its elements and inputs."
		/>
	)
}
