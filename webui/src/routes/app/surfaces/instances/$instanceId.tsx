import React, { useCallback, useContext } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faCog, faTimes } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { useComputed } from '~/Resources/util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const Route = createFileRoute('/_app/surfaces/instances/$instanceId')({
	component: ModuleConfigComponent,
})

function ModuleConfigComponent() {
	const { instanceId } = Route.useParams()

	const { surfaceInstances } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/surfaces/instances/$instanceId' })

	// Ensure the selected connection is valid
	useComputed(() => {
		if (!surfaceInstances.instances.has(instanceId)) {
			void navigate({ to: `/surfaces/instances` })
		}
	}, [navigate, surfaceInstances, instanceId])

	const closeConfigurePanel = useCallback(() => {
		void navigate({ to: `/surfaces/instances` })
	}, [navigate])

	return (
		<div className="surface-instance-config">
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">Configure Surface Instance: {instanceId}</h4>
				<div className="header-buttons">
					{/* {moduleVersion?.helpPath && (
						<div className="float_right" onClick={doShowHelp} title="Show help for this connection">
							<FontAwesomeIcon icon={faQuestionCircle} size="lg" />
						</div>
					)} */}
					<div className="float_right ms-1" onClick={closeConfigurePanel} title="Close">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</div>
				</div>
			</div>

			<NonIdealState icon={faCog} text="Surface instance configuration interface coming soon." />
		</div>
	)
}
