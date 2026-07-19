import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { CreatePageControlId } from '@companion-app/shared/ControlId.js'
import { LocalVariablesEditor } from '~/Controls/LocalVariablesEditor.js'
import { useLocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface PageVariablesPanelProps {
	pageNumber: number
}

/**
 * The "Page Variables" tab. These are variables owned by the page and exposed to every control on the
 * page as `$(page:varname)`. They are stored on a per-page `page:<pageId>` control, so this reuses the
 * standard local-variables editor against that control.
 */
export const PageVariablesPanel = observer(function PageVariablesPanel({ pageNumber }: PageVariablesPanelProps) {
	const { pages } = useContext(RootAppStoreContext)

	const pageInfo = pages.get(pageNumber)
	const controlId = pageInfo ? CreatePageControlId(pageInfo.id) : null

	const { controlConfig, error, reloadConfig } = useControlConfig(controlId)

	const config = controlConfig?.config
	const localVariables = config?.type === 'page' ? config.localVariables : null

	const localVariablesStore = useLocalVariablesStore(controlId ?? '', localVariables)

	const dataReady = !error && !!config && config.type === 'page'

	return (
		<div className="page-variables-panel">
			<LoadingRetryOrError dataReady={dataReady} error={error} doRetry={reloadConfig} design="pulse" />
			{dataReady && controlId && (
				<MyErrorBoundary>
					<LocalVariablesEditor
						heading="Page Variables"
						controlId={controlId}
						location={undefined}
						variables={localVariables ?? []}
						localVariablesStore={localVariablesStore}
						localVariablePrefix="page"
					/>
				</MyErrorBoundary>
			)}
		</div>
	)
})
