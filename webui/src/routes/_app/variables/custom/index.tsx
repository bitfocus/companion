import { faDollarSign } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/variables/custom/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faDollarSign}
			title="Select a custom variable"
			description="Choose a custom variable from the list to edit it."
		/>
	)
}
