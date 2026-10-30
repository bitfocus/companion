import { faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/link_/transports/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faNetworkWired}
			title="Select a transport"
			description="Choose a transport from the list to edit it, or add one to reach other installations."
		/>
	)
}
