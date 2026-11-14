import { createFileRoute, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { CreateCustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import { CUSTOM_FEEDBACK_EDIT_TAB_PATHS, type CustomFeedbackEditTab } from '~/CustomFeedbacks/customFeedbackEditTabs.js'
import { EditCustomFeedbackPanel } from '~/CustomFeedbacks/EditPanel.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()
	const matchRoute = useMatchRoute()
	const activeTab: CustomFeedbackEditTab =
		(['inputs', 'variables', 'uses'] as const).find((tab) => matchRoute({ to: CUSTOM_FEEDBACK_EDIT_TAB_PATHS[tab] })) ??
		'feedbacks'

	const navigate = useNavigate({ from: '/custom-feedbacks/$controlId' })
	const { customFeedbacksList } = useContext(RootAppStoreContext)

	const fullControlId = CreateCustomFeedbackControlId(controlId)

	// Ensure the selected custom feedback is valid
	useComputed(() => {
		if (fullControlId && !customFeedbacksList.customFeedbacks.get(fullControlId)) {
			void navigate({ to: `/custom-feedbacks` })
		}
	}, [navigate, customFeedbacksList, fullControlId])

	const setActiveTab = (nextTab: CustomFeedbackEditTab) => {
		void navigate({ to: CUSTOM_FEEDBACK_EDIT_TAB_PATHS[nextTab], params: { controlId } })
	}

	return (
		<div className="secondary-panel-simple-body p-0 flex flex-col min-h-0">
			<MyErrorBoundary>
				<EditCustomFeedbackPanel
					key={controlId}
					controlId={fullControlId}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/custom-feedbacks/$controlId')({
	component: RouteComponent,
})
