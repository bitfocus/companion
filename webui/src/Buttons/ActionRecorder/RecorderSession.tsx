import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { CCol, CCallout } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useActionRecorderActionService } from '~/Services/Controls/ControlActionsService.js'
import { LoadingRetryOrError } from '~/util.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { MinimalEntityList } from '~/Controls/Components/EntityList.js'

interface RecorderSessionProps {
	sessionId: string
	sessionInfo: RecordSessionInfo | null
}
export const RecorderSession = observer(function RecorderSession({ sessionId, sessionInfo }: RecorderSessionProps) {
	const actionsService = useActionRecorderActionService(sessionId)

	if (!sessionInfo || !sessionInfo.actions) return <LoadingRetryOrError dataReady={false} />

	return (
		<CCol xs={12} className="flex-form">
			<MinimalEntityList
				location={undefined}
				controlId={`action_recorder_${sessionInfo.id}`}
				ownerId={null}
				entities={sessionInfo.actions}
				readonly={!!sessionInfo.isRunning}
				serviceFactory={actionsService}
				entityType={EntityModelType.Action}
				entityTypeLabel="action"
				onlyFeedbackType={null}
			/>
			{sessionInfo.actions.length === 0 ? <CCallout color="info">No actions have been recorded</CCallout> : ''}
		</CCol>
	)
})
