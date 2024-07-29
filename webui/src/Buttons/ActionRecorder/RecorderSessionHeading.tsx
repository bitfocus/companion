import React, { useCallback, useContext, ChangeEvent, RefObject, useMemo } from 'react'
import {
	ConnectionsContext,
	socketEmitPromise,
	SocketContext,
	LoadingRetryOrError,
	PreventDefaultHandler,
} from '../../util.js'
import { CButton, CButtonGroup, CCol, CRow, CForm, CFormLabel, CFormSwitch, CCallout } from '@coreui/react'
import { DropdownInputField } from '../../Components/index.js'
import { ActionsList } from '../../Controls/ActionSetEditor.js'
import { usePanelCollapseHelperLite } from '../../Helpers/CollapseHelper.js'
import type { DropdownChoiceId } from '@companion-module/base'
import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { useActionRecorderActionService } from '../../Services/Controls/ControlActionsService.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { observer } from 'mobx-react-lite'

interface RecorderSessionHeadingProps {
	confirmRef: RefObject<GenericConfirmModalRef>
	sessionId: string
	sessionInfo: RecordSessionInfo
	doFinish: () => void
}

export function RecorderSessionHeading({ confirmRef, sessionId, sessionInfo, doFinish }: RecorderSessionHeadingProps) {
	const socket = useContext(SocketContext)
	const connections = useContext(ConnectionsContext)

	const doClearActions = useCallback(() => {
		socketEmitPromise(socket, 'action-recorder:session:discard-actions', [sessionId]).catch((e) => {
			console.error(e)
		})
	}, [socket, sessionId])

	const doAbort = useCallback(() => {
		if (confirmRef.current) {
			confirmRef.current.show(
				'Discard session',
				'Are you sure you wish to discard the current session?',
				'Discard',
				() => {
					socketEmitPromise(socket, 'action-recorder:session:abort', [sessionId]).catch((e) => {
						console.error(e)
					})
				}
			)
		}
	}, [socket, sessionId, confirmRef])

	const changeRecording = useCallback(
		(e: ChangeEvent<HTMLInputElement> | boolean) => {
			socketEmitPromise(socket, 'action-recorder:session:recording', [
				sessionId,
				typeof e === 'boolean' ? e : e.target.checked,
			]).catch((e) => {
				console.error(e)
			})
		},
		[socket, sessionId]
	)

	const doFinish2 = useCallback(() => {
		changeRecording(false)

		doFinish()
	}, [changeRecording, doFinish])

	const changeConnectionIds = useCallback(
		(ids: DropdownChoiceId[]) => {
			const connectionIds = ids.map((id) => String(id))
			socketEmitPromise(socket, 'action-recorder:session:set-connections', [sessionId, connectionIds]).catch((e) => {
				console.error(e)
			})
		},
		[socket, sessionId]
	)

	const connectionsWhichCanRecord = useMemo(() => {
		const result = []

		for (const [id, info] of Object.entries(connections)) {
			if (info.hasRecordActionsHandler) {
				result.push({
					id,
					label: info.label,
				})
			}
		}

		return result
	}, [connections])

	return (
		<>
			<CForm onSubmit={PreventDefaultHandler}>
				<CRow className="flex-form flex-form-row" style={{ clear: 'both' }}>
					<div className="flex w-full gap-2rem">
						<div className="w-full">
							<CFormLabel>Connections</CFormLabel>
							<DropdownInputField<true>
								value={sessionInfo.connectionIds}
								setValue={changeConnectionIds}
								multiple={true}
								choices={connectionsWhichCanRecord}
							/>
						</div>

						<div>
							<CFormLabel>Recording</CFormLabel>
							<p>
								<CFormSwitch color="success" size="xl" checked={!!sessionInfo.isRunning} onChange={changeRecording} />
							</p>
						</div>
					</div>
				</CRow>

				<CRow className="flex-form-row" style={{ clear: 'both' }}>
					<div>
						<CButtonGroup className={'margin-bottom'}>
							<CButton onClick={doClearActions} color="secondary" disabled={!sessionInfo.actions?.length}>
								Clear Actions
							</CButton>
							<CButton onClick={doAbort} color="danger">
								Discard
							</CButton>
							<CButton onClick={doFinish2} color="secondary" disabled={!sessionInfo.actions?.length}>
								Finish
							</CButton>
						</CButtonGroup>
					</div>
				</CRow>
			</CForm>
		</>
	)
}
interface RecorderSessionProps {
	sessionId: string
	sessionInfo: RecordSessionInfo | null
}
export const RecorderSession = observer(function RecorderSession({ sessionId, sessionInfo }: RecorderSessionProps) {
	const actionsService = useActionRecorderActionService(sessionId)

	const panelCollapseHelper = usePanelCollapseHelperLite(
		'action_recorder',
		sessionInfo?.actions?.map((a) => a.id) ?? []
	)

	if (!sessionInfo || !sessionInfo.actions) return <LoadingRetryOrError dataReady={false} />

	return (
		<CCol xs={12} className="flex-form">
			<ActionsList
				location={undefined}
				stepId=""
				setId=""
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
