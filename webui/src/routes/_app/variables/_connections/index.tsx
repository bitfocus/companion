import { faDollarSign } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/variables/_connections/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faDollarSign}
			title="Select a connection"
			description="Choose a connection from the list to browse its variables."
		/>
	)
}
