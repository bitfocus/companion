import React, { useCallback, useContext, type RefObject } from 'react'
import { PreventDefaultHandler, useComputed } from '~/Resources/util.js'
import { CButton, CButtonGroup, CRow, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import { MultiDropdownInputField } from '~/Components/index.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface RecorderSessionHeadingProps {
	confirmRef: RefObject<GenericConfirmModalRef>
	sessionInfo: RecordSessionInfo
	doFinish: () => void
}

export const RecorderSessionHeading = observer(function RecorderSessionHeading({
	confirmRef,
	sessionInfo,
	doFinish,
}: RecorderSessionHeadingProps) {
	const { connections } = useContext(RootAppStoreContext)

	const discardActionsMutation = useMutationExt(trpc.actionRecorder.session.discardActions.mutationOptions())
	const abortSessionMutation = useMutationExt(trpc.actionRecorder.session.abort.mutationOptions())
	const setRecordingMutation = useMutationExt(trpc.actionRecorder.session.setRecording.mutationOptions())
	const setConnectionsMutation = useMutationExt(trpc.actionRecorder.session.setConnections.mutationOptions())

	const sessionId = sessionInfo.id
	const doClearActions = useCallback(() => {
		discardActionsMutation.mutateAsync({ sessionId }).catch((e) => {
			console.error(e)
		})
	}, [discardActionsMutation, sessionId])

	const doAbort = useCallback(() => {
		if (confirmRef.current) {
			confirmRef.current.show(
				'Discard session',
				'Are you sure you wish to discard the current session?',
				'Discard',
				() => {
					abortSessionMutation.mutateAsync({ sessionId }).catch((e) => {
						console.error(e)
					})
				}
			)
		}
	}, [abortSessionMutation, sessionId, confirmRef])

	const changeRecording = useCallback(
		(e: React.ChangeEvent<HTMLInputElement> | boolean) => {
			const isRunning = typeof e === 'boolean' ? e : e.target.checked
			setRecordingMutation.mutateAsync({ sessionId, isRunning }).catch((e) => {
				console.error(e)
			})
		},
		[setRecordingMutation, sessionId]
	)

	const doFinish2 = useCallback(() => {
		changeRecording(false)

		doFinish()
	}, [changeRecording, doFinish])

	const changeConnectionIds = useCallback(
		(ids: DropdownChoiceId[]) => {
			const connectionIds = ids.map((id) => String(id))
			setConnectionsMutation.mutateAsync({ sessionId, connectionIds }).catch((e) => {
				console.error(e)
			})
		},
		[setConnectionsMutation, sessionId]
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
							<MultiDropdownInputField
								value={sessionInfo.connectionIds}
								setValue={changeConnectionIds}
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
