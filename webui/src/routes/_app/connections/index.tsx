import { faPlug } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/connections/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body no-scroll">
			<NonIdealState text="Select a connection to edit" icon={faPlug} />
		</div>
	)
}
