import { faClock } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/triggers/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body no-scroll flex items-center justify-center">
			<NonIdealState icon={faClock}>
				<h4 className="my-1 font-semibold text-body">No trigger selected</h4>
				<p className="my-2 text-sm text-muted max-w-sm">
					Triggers automatically execute actions based on time schedules, event conditions, or variable changes.
				</p>
				<p className="text-xs text-muted">Select a trigger from the list to edit its events and actions.</p>
			</NonIdealState>
		</div>
	)
}
