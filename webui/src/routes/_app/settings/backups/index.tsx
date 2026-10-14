import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/settings/backups/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faCalendarAlt}
			title="Select a backup rule"
			description="Choose a backup rule from the list to edit it."
		/>
	)
}
