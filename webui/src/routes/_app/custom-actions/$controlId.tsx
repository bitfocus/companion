import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { CreateCustomActionControlId } from '@companion-app/shared/ControlId.js'
import { EditCustomActionPanel } from '~/CustomActions/EditPanel.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()

	const navigate = useNavigate({ from: '/custom-actions/$controlId' })
	const { customActionsList } = useContext(RootAppStoreContext)

	const fullControlId = CreateCustomActionControlId(controlId)

	// Ensure the selected custom action is valid
	useComputed(() => {
		if (fullControlId && !customActionsList.customActions.get(fullControlId)) {
			void navigate({ to: `/custom-actions` })
		}
	}, [navigate, customActionsList, fullControlId])

	return (
		<div className="secondary-panel-simple-body p-0 flex flex-col min-h-0">
			<MyErrorBoundary>
				<EditCustomActionPanel key={controlId} controlId={fullControlId} />
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/custom-actions/$controlId')({
	component: RouteComponent,
})
