import { faImage } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/image-library/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="secondary-panel-simple-body no-scroll">
			<NonIdealState text="Select an image to edit" icon={faImage} />
		</div>
	)
}
