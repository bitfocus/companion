import { faCog } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/settings/advanced/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faCog}
			title="Select a setting"
			description="Choose one from the list to change its settings or find its documentation."
		/>
	)
}
