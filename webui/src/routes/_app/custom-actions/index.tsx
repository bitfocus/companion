import { faCubes } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/custom-actions/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faCubes}
			title="Select a custom action"
			description="Choose a custom action from the list to edit its inputs and actions."
		/>
	)
}
