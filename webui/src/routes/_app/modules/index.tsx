import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'

export const Route = createFileRoute('/_app/modules/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<PanelEmptyState
			icon={faPuzzlePiece}
			title="Select a module"
			description="Choose a module from the list to manage its installed versions."
		/>
	)
}
