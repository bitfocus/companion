import React, { useCallback, useContext, ChangeEvent, RefObject, useMemo } from 'react'
import { LoadingRetryOrError, PreventDefaultHandler, useComputed } from '../../util.js'
import { CButton, CButtonGroup, CCol, CRow, CForm, CFormLabel, CFormSwitch, CCallout } from '@coreui/react'
import { DropdownInputField } from '../../Components/index.js'
import { PanelCollapseHelperProvider } from '../../Helpers/CollapseHelper.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { useActionRecorderActionService } from '../../Services/Controls/ControlActionsService.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { MinimalEntityList } from '../../Controls/Components/EntityList.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

interface RecorderSessionHeadingProps {
	confirmRef: RefObject<GenericConfirmModalRef>
	sessionId: string
	sessionInfo: RecordSessionInfo
	doFinish: () => void
}

export const RecorderSessionHeading = observer(function RecorderSessionHeading({
	confirmRef,
	sessionId,
	sessionInfo,
	doFinish,
}: RecorderSessionHeadingProps) {
	const { connections, socket } = useContext(RootAppStoreContext)

	const doClearActions = useCallback(() => {
		socket.emitPromise('action-recorder:session:discard-actions', [sessionId]).catch((e) => {
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
					socket.emitPromise('action-recorder:session:abort', [sessionId]).catch((e) => {
						console.error(e)
					})
				}
			)
		}
	}, [socket, sessionId, confirmRef])

	const changeRecording = useCallback(
		(e: ChangeEvent<HTMLInputElement> | boolean) => {
			socket
				.emitPromise('action-recorder:session:recording', [sessionId, typeof e === 'boolean' ? e : e.target.checked])
				.catch((e) => {
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
			socket.emitPromise('action-recorder:session:set-connections', [sessionId, connectionIds]).catch((e) => {
				console.error(e)
			})
		},
		[socket, sessionId]
	)

	const connectionsWhichCanRecord = useComputed(() => {
		const result: DropdownChoice[] = []

		for (const [id, info] of connections.connections.entries()) {
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
})

interface RecorderSessionProps {
	sessionId: string
	sessionInfo: RecordSessionInfo | null
}
export const RecorderSession = observer(function RecorderSession({ sessionId, sessionInfo }: RecorderSessionProps) {
	const actionsService = useActionRecorderActionService(sessionId)

	const actionIds = useMemo(() => sessionInfo?.actions?.map((a) => a.id) ?? [], [sessionInfo?.actions])

	if (!sessionInfo || !sessionInfo.actions) return <LoadingRetryOrError dataReady={false} />

	return (
		<CCol xs={12} className="flex-form">
			<PanelCollapseHelperProvider storageId="action_recorder" knownPanelIds={actionIds}>
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
			</PanelCollapseHelperProvider>
			{sessionInfo.actions.length === 0 ? <CCallout color="info">No actions have been recorded</CCallout> : ''}
		</CCol>
	)
})
