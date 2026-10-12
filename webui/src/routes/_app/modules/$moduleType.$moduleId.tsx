import { createFileRoute } from '@tanstack/react-router'
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
	const { tab, docsVersion } = Route.useSearch()

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
	validateSearch: (search: Record<string, unknown>): { tab?: 'docs'; docsVersion?: string } => ({
		tab: search.tab === 'docs' ? 'docs' : undefined,
		docsVersion: typeof search.docsVersion === 'string' ? search.docsVersion : undefined,
	}),
	component: RouteComponent,
})
