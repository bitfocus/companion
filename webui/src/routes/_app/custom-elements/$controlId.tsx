import { createFileRoute, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { CreateCustomElementControlId } from '@companion-app/shared/ControlId.js'
import { CUSTOM_ELEMENT_EDIT_TAB_PATHS, type CustomElementEditTab } from '~/CustomElements/customElementEditTabs.js'
import { EditCustomElementPanel } from '~/CustomElements/EditPanel.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()
	const matchRoute = useMatchRoute()
	const activeTab: CustomElementEditTab =
		(['inputs', 'uses'] as const).find((tab) => matchRoute({ to: CUSTOM_ELEMENT_EDIT_TAB_PATHS[tab] })) ?? 'elements'

	const navigate = useNavigate({ from: '/custom-elements/$controlId' })
	const { customElementsList } = useContext(RootAppStoreContext)

	const fullControlId = CreateCustomElementControlId(controlId)

	// Ensure the selected custom feedback is valid
	useComputed(() => {
		if (fullControlId && !customElementsList.customElements.get(fullControlId)) {
			void navigate({ to: `/custom-elements` })
		}
	}, [navigate, customElementsList, fullControlId])

	const setActiveTab = (nextTab: CustomElementEditTab) => {
		void navigate({ to: CUSTOM_ELEMENT_EDIT_TAB_PATHS[nextTab], params: { controlId } })
	}

	return (
		<div className="secondary-panel-simple-body p-0 flex flex-col min-h-0">
			<MyErrorBoundary>
				<EditCustomElementPanel
					key={controlId}
					controlId={fullControlId}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/custom-elements/$controlId')({
	component: RouteComponent,
})
