import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CustomVariableEditPanel } from '~/Variables/CustomVariableEditPanel.js'

const RouteComponent = observer(function RouteComponent() {
	const { name } = Route.useParams()

	const navigate = useNavigate({ from: '/variables/custom/$name' })
	const { variablesStore } = useContext(RootAppStoreContext)

	// Ensure the selected variable is valid
	useComputed(() => {
		if (!variablesStore.customVariables.get(name)) {
			void navigate({ to: `/variables/custom` })
		}
	}, [navigate, variablesStore, name])

	return (
		<div className="secondary-panel-simple-body">
			<MyErrorBoundary>
				<CustomVariableEditPanel key={name} name={name} />
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/variables/custom/$name')({
	component: RouteComponent,
})
