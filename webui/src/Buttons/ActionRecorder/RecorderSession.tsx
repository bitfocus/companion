import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { CCol, CCallout } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { ActionsList } from '../../Controls/ActionSetEditor.js'
import type { PanelCollapseHelper } from '../../Helpers/CollapseHelper.js'
import { useActionRecorderActionService } from '../../Services/Controls/ControlActionsService.js'
import { LoadingRetryOrError } from '../../util.js'

interface RecorderSessionProps {
	panelCollapseHelper: PanelCollapseHelper
	sessionId: string
	sessionInfo: RecordSessionInfo | null
}
export const RecorderSession = observer(function RecorderSession({
	panelCollapseHelper,
	sessionId,
	sessionInfo,
}: RecorderSessionProps) {
	const actionsService = useActionRecorderActionService(sessionId)

	if (!sessionInfo || !sessionInfo.actions) return <LoadingRetryOrError dataReady={false} />

	return (
		<CCol xs={12} className="flex-form">
			<ActionsList
				location={undefined}
				controlId=""
				stepId=""
				setId={0}
				parentId={null}
				dragId={'triggerAction'}
				actions={sessionInfo.actions}
				readonly={!!sessionInfo.isRunning}
				actionsService={actionsService}
				panelCollapseHelper={panelCollapseHelper}
			/>
			{sessionInfo.actions.length === 0 ? <CCallout color="info">No actions have been recorded</CCallout> : ''}
		</CCol>
	)
})
