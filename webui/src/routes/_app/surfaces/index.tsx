import { faGamepad } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/surfaces/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body no-scroll">
			<NonIdealState text="Select a surface or group to configure it" icon={faGamepad} />
		</div>
	)
}
