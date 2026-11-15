import { createFileRoute, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { CreateCustomActionControlId } from '@companion-app/shared/ControlId.js'
import { CUSTOM_ACTION_EDIT_TAB_PATHS, type CustomActionEditTab } from '~/CustomActions/customActionEditTabs.js'
import { EditCustomActionPanel } from '~/CustomActions/EditPanel.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()
	const matchRoute = useMatchRoute()
	const activeTab: CustomActionEditTab =
		(['inputs', 'variables', 'uses'] as const).find((tab) => matchRoute({ to: CUSTOM_ACTION_EDIT_TAB_PATHS[tab] })) ??
		'actions'

	const navigate = useNavigate({ from: '/custom-actions/$controlId' })
	const { customActionsList } = useContext(RootAppStoreContext)

	const fullControlId = CreateCustomActionControlId(controlId)

	// Ensure the selected custom action is valid
	useComputed(() => {
		if (fullControlId && !customActionsList.customActions.get(fullControlId)) {
			void navigate({ to: `/custom-actions` })
		}
	}, [navigate, customActionsList, fullControlId])

	const setActiveTab = (nextTab: CustomActionEditTab) => {
		void navigate({ to: CUSTOM_ACTION_EDIT_TAB_PATHS[nextTab], params: { controlId } })
	}

	return (
		<div className="secondary-panel-simple-body p-0 flex flex-col min-h-0">
			<MyErrorBoundary>
				<EditCustomActionPanel
					key={controlId}
					controlId={fullControlId}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/custom-actions/$controlId')({
	component: RouteComponent,
})
