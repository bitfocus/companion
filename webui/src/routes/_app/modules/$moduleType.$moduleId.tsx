import { createFileRoute, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { ModuleManagePanel } from '~/Modules/ModuleManagePanel.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { modules } = useContext(RootAppStoreContext)

	const { moduleType, moduleId } = Route.useParams()
	const matchRoute = useMatchRoute()
	const tab = matchRoute({ to: '/modules/$moduleType/$moduleId/docs', fuzzy: true }) ? 'docs' : undefined
	const docsVersionMatch = matchRoute({ to: '/modules/$moduleType/$moduleId/docs/$docsVersion' })
	const docsVersion = docsVersionMatch ? docsVersionMatch.docsVersion : undefined

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
			{moduleId && (
				<ModuleManagePanel
					key={`${moduleType}:${moduleId}`}
					moduleType={moduleTypeCast}
					moduleId={moduleId}
					tab={tab}
					docsVersion={docsVersion}
				/>
			)}
		</MyErrorBoundary>
	)
})

export const Route = createFileRoute('/_app/modules/$moduleType/$moduleId')({
	component: RouteComponent,
})
