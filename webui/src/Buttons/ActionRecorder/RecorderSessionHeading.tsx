import React, { useCallback, useContext, ChangeEvent, RefObject } from 'react'
import { PreventDefaultHandler, useComputed } from '../../util.js'
import { CButton, CButtonGroup, CRow, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import { MultiDropdownInputField } from '../../Components/index.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'

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
