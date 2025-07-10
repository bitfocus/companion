import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { EditCustomVariablePanel } from '~/CustomVariables/EditPanel.js'
import { MyErrorBoundary, useComputed } from '~/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CreateCustomVariableControlId } from '@companion-app/shared/ControlId.js'
import { observer } from 'mobx-react-lite'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()

	const navigate = useNavigate({ from: '/custom-variables/$controlId' })
	const { customVariablesList } = useContext(RootAppStoreContext)

	const fullControlId = CreateCustomVariableControlId(controlId)

	// Ensure the selected trigger is valid
	useComputed(() => {
		if (fullControlId && !customVariablesList.customVariables.get(fullControlId)) {
			void navigate({ to: `/custom-variables` })
		}
	}, [navigate, customVariablesList, fullControlId])

	return (
		<div className="secondary-panel-simple">
			<div className="secondary-panel-simple-body">
				<MyErrorBoundary>
					<EditCustomVariablePanel key={controlId} controlId={fullControlId} />
				</MyErrorBoundary>
			</div>
		</div>
	)
})

export const Route = createFileRoute('/_app/custom-variables/$controlId')({
	component: RouteComponent,
})
