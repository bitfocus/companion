import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { EditComputedVariablePanel } from '~/Variables/ComputedVariables/EditPanel.js'
import { useComputed } from '~/Resources/util'
import { MyErrorBoundary } from '~/Resources/Error'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CreateComputedVariableControlId } from '@companion-app/shared/ControlId.js'
import { observer } from 'mobx-react-lite'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()

	const navigate = useNavigate({ from: '/variables/computed/$controlId' })
	const { computedVariablesList } = useContext(RootAppStoreContext)

	const fullControlId = CreateComputedVariableControlId(controlId)

	// Ensure the selected trigger is valid
	useComputed(() => {
		if (fullControlId && !computedVariablesList.computedVariables.get(fullControlId)) {
			void navigate({ to: `/variables/computed` })
		}
	}, [navigate, computedVariablesList, fullControlId])

	return (
		<div className="secondary-panel-simple-body">
			<MyErrorBoundary>
				<EditComputedVariablePanel key={controlId} controlId={fullControlId} />
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/variables/computed/$controlId')({
	component: RouteComponent,
})
