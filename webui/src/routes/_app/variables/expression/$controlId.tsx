import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { EditExpressionVariablePanel } from '~/Variables/ExpressionVariables/EditPanel.js'
import { useComputed } from '~/Resources/util'
import { MyErrorBoundary } from '~/Resources/Error'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CreateExpressionVariableControlId } from '@companion-app/shared/ControlId.js'
import { observer } from 'mobx-react-lite'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()

	const navigate = useNavigate({ from: '/variables/expression/$controlId' })
	const { expressionVariablesList } = useContext(RootAppStoreContext)

	const fullControlId = CreateExpressionVariableControlId(controlId)

	// Ensure the selected trigger is valid
	useComputed(() => {
		if (fullControlId && !expressionVariablesList.expressionVariables.get(fullControlId)) {
			void navigate({ to: `/variables/expression` })
		}
	}, [navigate, expressionVariablesList, fullControlId])

	return (
		<div className="secondary-panel-simple-body">
			<MyErrorBoundary>
				<EditExpressionVariablePanel key={controlId} controlId={fullControlId} />
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/variables/expression/$controlId')({
	component: RouteComponent,
})
