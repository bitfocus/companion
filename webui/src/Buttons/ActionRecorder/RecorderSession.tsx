import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { CCol, CCallout } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useActionRecorderActionService } from '~/Services/Controls/ControlActionsService.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { MinimalEntityList } from '~/Controls/Components/EntityList.js'
import { EntityEditorContextProvider } from '~/Controls/Components/EntityEditorContext'

interface RecorderSessionProps {
	sessionId: string
	sessionInfo: RecordSessionInfo | null
}
export const RecorderSession = observer(function RecorderSession({ sessionId, sessionInfo }: RecorderSessionProps) {
	const actionsService = useActionRecorderActionService(sessionId)

	if (!sessionInfo || !sessionInfo.actions) return <LoadingRetryOrError dataReady={false} design="pulse" />

	return (
		<CCol xs={12} className="flex-form">
			<EntityEditorContextProvider
				controlId={`action_recorder_${sessionInfo.id}`}
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
			{sessionInfo.actions.length === 0 ? <CCallout color="info">No actions have been recorded</CCallout> : ''}
		</CCol>
	)
})
