import { observer } from 'mobx-react-lite'
import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { EntityEditorContextProvider } from '~/Controls/Components/EntityEditorContext'
import { MinimalEntityList } from '~/Controls/Components/EntityList.js'
import { useEntityListReorderMonitor } from '~/Controls/Components/useEntityListReorderMonitor.js'
import { EntityListActionContext } from '~/Controls/LocalVariablesStore'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { useActionRecorderActionService } from '~/Services/Controls/ControlActionsService.js'

interface RecorderSessionProps {
	sessionId: string
	sessionInfo: RecordSessionInfo | null
}
export const RecorderSession = observer(function RecorderSession({ sessionId, sessionInfo }: RecorderSessionProps) {
	const actionsService = useActionRecorderActionService(sessionId)

	const recorderControlId = `action_recorder_${sessionInfo?.id ?? sessionId}`
	useEntityListReorderMonitor(recorderControlId, EntityModelType.Action, actionsService)

	if (!sessionInfo || !sessionInfo.actions) return <LoadingRetryOrError dataReady={false} design="pulse" />

	return (
		<div className="recorder-actions-list">
			<EntityEditorContextProvider
				controlId={recorderControlId}
				location={undefined}
				serviceFactory={actionsService}
				readonly={!!sessionInfo.isRunning}
				localVariablesStore={null}
				localVariablePrefix={null}
				actionContext={EntityListActionContext.Actions}
			>
				<MinimalEntityList
					ownerId={null}
					entities={sessionInfo.actions}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					feedbackListType={null}
				/>
			</EntityEditorContextProvider>
			{sessionInfo.actions.length === 0 ? (
				<div className="recorder-empty-state">
					No actions recorded yet. Use a supported connection to capture actions.
				</div>
			) : null}
		</div>
	)
})
