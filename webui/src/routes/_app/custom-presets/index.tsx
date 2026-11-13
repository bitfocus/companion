import { faSwatchbook } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/custom-presets/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faSwatchbook}
			title="Select a custom preset"
			description="Choose a custom preset from the list to edit its button."
		/>
	)
}
