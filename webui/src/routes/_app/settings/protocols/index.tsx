import { faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/settings/protocols/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faNetworkWired}
			title="Select a protocol"
			description="Choose a protocol from the list to change its settings or find its API reference."
		/>
	)
}
