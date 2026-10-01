import { faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/variables/expression/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faSquareRootVariable}
			title="Select an expression variable"
			description="Choose an expression variable from the list to edit it."
		/>
	)
}
