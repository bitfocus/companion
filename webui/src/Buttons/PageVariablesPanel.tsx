import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { CreatePageControlId, type PageControlId } from '@companion-app/shared/ControlId.js'
import { ButtonsSidebarSection } from '~/Buttons/ButtonsSidebarSection.js'
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
	if (!pageInfo) {
		return (
			<ButtonsSidebarSection className={undefined} title="Page Variables" actions={null}>
				<LoadingRetryOrError dataReady={false} design="pulse" />
			</ButtonsSidebarSection>
		)
	}

	return <PageVariablesEditor controlId={CreatePageControlId(pageInfo.id)} />
})

const PageVariablesEditor = observer(function PageVariablesEditor({ controlId }: { controlId: PageControlId }) {
	const { controlConfig, error, reloadConfig } = useControlConfig(controlId)

	const localVariables = controlConfig?.config.localVariables ?? null

	const localVariablesStore = useLocalVariablesStore(controlId, localVariables)

	const dataReady = !error && !!controlConfig

	return (
		// Once loaded, the editor draws the title so its expand/collapse controls sit beside it
		<ButtonsSidebarSection className={undefined} title={dataReady ? null : 'Page Variables'} actions={null}>
			<LoadingRetryOrError dataReady={dataReady} error={error} doRetry={reloadConfig} design="pulse" />
			{dataReady && (
				<MyErrorBoundary>
					<LocalVariablesEditor
						// Cancels the heading row's top margin, so the title sits where the other sections' titles do
						className="-mt-2"
						heading={<h5 className="buttons-sidebar-heading">Page Variables</h5>}
						controlId={controlId}
						location={undefined}
						variables={localVariables ?? []}
						localVariablesStore={localVariablesStore}
						localVariablePrefix="page"
					/>
				</MyErrorBoundary>
			)}
		</ButtonsSidebarSection>
	)
})
