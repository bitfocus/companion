import { observer } from 'mobx-react-lite'
import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { Callout } from '~/Components/Callout'
import { Grid } from '~/Components/Grid'
import { EntityEditorContextProvider } from '~/Controls/Components/EntityEditorContext'
import { MinimalEntityList } from '~/Controls/Components/EntityList.js'
import { useEntityListReorderMonitor } from '~/Controls/Components/useEntityListReorderMonitor.js'
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
		<Grid.Col xs={12} className="flex-form">
			<EntityEditorContextProvider
				controlId={recorderControlId}
				location={undefined}
				serviceFactory={actionsService}
				readonly={!!sessionInfo.isRunning}
				localVariablesStore={null}
				localVariablePrefix={null}
			>
				<MinimalEntityList
					ownerId={null}
					entities={sessionInfo.actions}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					feedbackListType={null}
				/>
			</EntityEditorContextProvider>
			{sessionInfo.actions.length === 0 ? <Callout color="info">No actions have been recorded</Callout> : ''}
		</Grid.Col>
	)
})
