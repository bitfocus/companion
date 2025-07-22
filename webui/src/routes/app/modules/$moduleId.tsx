import { createFileRoute } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { ModuleManagePanel } from '~/Modules/ModuleManagePanel.js'
import { useComputed } from '~/Resources/util.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { modules } = useContext(RootAppStoreContext)

	const { moduleId } = Route.useParams()

	const navigate = Route.useNavigate()

	// Ensure the selected module is valid
	useComputed(() => {
		if (moduleId && !modules.modules.get(moduleId) && !modules.storeList.has(moduleId)) {
			void navigate({ to: `/modules` })
		}
	}, [navigate, modules, moduleId])

	return <MyErrorBoundary>{moduleId && <ModuleManagePanel key={moduleId} moduleId={moduleId} />}</MyErrorBoundary>
})

export const Route = createFileRoute('/_app/modules/$moduleId')({
	component: RouteComponent,
})
