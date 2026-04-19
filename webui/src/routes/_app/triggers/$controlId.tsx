import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { EditTriggerPanel } from '~/Triggers/EditPanel.js'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()

	const navigate = useNavigate({ from: '/triggers/$controlId' })
	const { triggersList } = useContext(RootAppStoreContext)

	const fullControlId = CreateTriggerControlId(controlId)

	// Ensure the selected trigger is valid
	useComputed(() => {
		if (fullControlId && !triggersList.triggers.get(fullControlId)) {
			void navigate({ to: `/triggers` })
		}
	}, [navigate, triggersList, fullControlId])

	return (
		<div className="secondary-panel-simple-body">
			<MyErrorBoundary>
				<EditTriggerPanel key={controlId} controlId={fullControlId} />
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/triggers/$controlId')({
	component: RouteComponent,
})
