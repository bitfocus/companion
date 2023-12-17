import React, { useCallback, useContext, ChangeEvent, RefObject } from 'react'
import {
	ConnectionsContext,
	socketEmitPromise,
	SocketContext,
	LoadingRetryOrError,
	PreventDefaultHandler,
} from '../../util'
import { CButton, CAlert, CButtonGroup, CCol, CRow, CForm, CLabel } from '@coreui/react'
import { useMemo } from 'react'
import { DropdownInputField } from '../../Components'
import { ActionsList } from '../../Controls/ActionSetEditor'
import { usePanelCollapseHelper } from '../../Helpers/CollapseHelper'
import CSwitch from '../../CSwitch'
import type { DropdownChoiceId } from '@companion-module/base'
import type { RecordSessionInfo } from '@companion/shared/Model/ActionRecorderModel'
import { useActionRecorderActionService } from '../../Services/Controls/ControlActionsService'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal'

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
			socketEmitPromise(socket, 'action-recorder:session:set-connections', [sessionId, ids]).catch((e) => {
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
				<CRow form className="flex-form flex-form-row" style={{ clear: 'both' }}>
					<div className="flex w-full gap-2">
						<div className="w-full">
							<CLabel>Connections</CLabel>
							<DropdownInputField<true>
								value={sessionInfo.connectionIds}
								setValue={changeConnectionIds}
								multiple={true}
								choices={connectionsWhichCanRecord}
							/>
						</div>

						<div>
							<CLabel>Recording</CLabel>
							<p>
								<CSwitch color="success" size="lg" checked={!!sessionInfo.isRunning} onChange={changeRecording} />
							</p>
						</div>
					</div>
				</CRow>

				<CRow form className="flex-form-row" style={{ clear: 'both' }}>
					<CButtonGroup className={'margin-bottom'}>
						<CButton onClick={doClearActions} color="danger" disabled={!sessionInfo.actions?.length}>
							Clear Actions
						</CButton>
						<CButton onClick={doAbort} color="danger">
							Discard
						</CButton>
						<CButton onClick={doFinish2} color="danger" disabled={!sessionInfo.actions?.length}>
							Finish
						</CButton>
					</CButtonGroup>
				</CRow>
			</CForm>
		</>
	)
}
interface RecorderSessionProps {
	sessionId: string
	sessionInfo: RecordSessionInfo | null
}
export function RecorderSession({ sessionId, sessionInfo }: RecorderSessionProps) {
	const actionsService = useActionRecorderActionService(sessionId)

	const { setPanelCollapsed, isPanelCollapsed } = usePanelCollapseHelper(
		`action_recorder`,
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
				setPanelCollapsed={setPanelCollapsed}
				isPanelCollapsed={isPanelCollapsed}
			/>
			{sessionInfo.actions.length === 0 ? <CAlert color="info">No actions have been recorded</CAlert> : ''}
		</CCol>
	)
}
