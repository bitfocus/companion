import { faGamepad } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/surfaces/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faGamepad}
			title="Select a surface"
			description="Choose a surface or group from the list to configure it."
		/>
	)
}
