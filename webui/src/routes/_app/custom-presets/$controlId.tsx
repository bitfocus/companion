import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { CreateCustomPresetControlId } from '@companion-app/shared/ControlId.js'
import { EditCustomPresetPanel } from '~/CustomPresets/EditPanel.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()

	const navigate = useNavigate({ from: '/custom-presets/$controlId' })
	const { customPresetsList } = useContext(RootAppStoreContext)

	const fullControlId = CreateCustomPresetControlId(controlId)

	// Ensure the selected custom preset is valid
	useComputed(() => {
		if (fullControlId && !customPresetsList.customPresets.get(fullControlId)) {
			void navigate({ to: `/custom-presets` })
		}
	}, [navigate, customPresetsList, fullControlId])

	return (
		<div className="secondary-panel-simple-body p-0 flex flex-col min-h-0">
			<MyErrorBoundary>
				<EditCustomPresetPanel key={controlId} controlId={fullControlId} />
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/custom-presets/$controlId')({
	component: RouteComponent,
})
