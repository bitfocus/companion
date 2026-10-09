import { faGamepad } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/surfaces_/integrations/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faGamepad}
			title="Select an integration"
			description="Choose a surface integration from the list to edit its configuration."
		/>
	)
}
