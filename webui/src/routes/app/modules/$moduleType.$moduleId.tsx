import { createFileRoute } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { ModuleManagePanel } from '~/Modules/ModuleManagePanel.js'
import { useComputed } from '~/Resources/util.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

const RouteComponent = observer(function RouteComponent() {
	const { modules } = useContext(RootAppStoreContext)

	const { moduleType, moduleId } = Route.useParams()

	const moduleTypeCast = moduleType as ModuleInstanceType

	const navigate = Route.useNavigate()

	// Ensure the selected module is valid
	useComputed(() => {
		if (
			moduleId &&
			!modules.getModuleInfo(moduleTypeCast, moduleId) &&
			!modules.getStoreInfo(moduleTypeCast, moduleId)
		) {
			void navigate({ to: `/modules` })
		}
	}, [navigate, modules, moduleId])

	return (
		<MyErrorBoundary>
			{moduleId && <ModuleManagePanel key={moduleId} moduleType={moduleTypeCast} moduleId={moduleId} />}
		</MyErrorBoundary>
	)
})

export const Route = createFileRoute('/_app/modules/$moduleType/$moduleId')({
	component: RouteComponent,
})
