import React, { useCallback, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { SocketContext, applyPatchOrReplaceObject } from '~/util.js'
import { CCallout, CCol, CRow } from '@coreui/react'
import { GenericConfirmModal } from '~/Components/GenericConfirmModal.js'
import type { RecordSessionInfo, RecordSessionListInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { RecorderSessionFinishModal } from './RecorderSessionFinishModal.js'
import { RecorderSessionHeading } from './RecorderSessionHeading.js'
import { RecorderSession } from './RecorderSession.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'

export function ActionRecorder() {
	const socket = useContext(SocketContext)

	const confirmRef = useRef(null)

	const [sessions, setSessions] = useState<Record<string, RecordSessionListInfo | undefined> | null>(null)
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
	const [isFinishing, setIsFinishing] = useState(false)

	// Subscribe to the list of sessions
	useEffect(() => {
		socket
			.emitPromise('action-recorder:subscribe', [])
			.then((newSessions) => {
				setSessions(newSessions)

				setSelectedSessionId(Object.keys(newSessions).sort()[0] || null)
				setIsFinishing(false)
			})
			.catch((e) => {
				console.error('Action record subscribe', e)
			})

		const unsubList = socket.on('action-recorder:session-list', (newSessions) => {
			setSessions((oldSessions) => oldSessions && applyPatchOrReplaceObject(oldSessions, newSessions))
		})

		return () => {
			socket.emitPromise('action-recorder:unsubscribe', []).catch((e) => {
				console.error('Action record subscribe', e)
			})

			unsubList()
		}
	}, [socket])

	// Ensure the sessionId remains valid
	useEffect(() => {
		setSelectedSessionId((oldId) => {
			return sessions && oldId && sessions[oldId] ? oldId : Object.keys(sessions || {}).sort()[0] || null
		})
	}, [sessions])

	useEffect(() => {
		setIsFinishing(false)
	}, [selectedSessionId])

	const [sessionInfo, setSessionInfo] = useState<RecordSessionInfo | null>(null)

	useEffect(() => {
		setSessionInfo(null)

		if (!selectedSessionId) return
		socket
			.emitPromise('action-recorder:session:subscribe', [selectedSessionId])
			.then((info) => {
				setSessionInfo(info)
			})
			.catch((e) => {
				console.error('Action record session subscribe', e)
			})

		const unsubUpdate = socket.on(`action-recorder:session:update:${selectedSessionId}`, (patch) => {
			setSessionInfo((oldInfo) => oldInfo && applyPatchOrReplaceObject(oldInfo, patch))
		})

		return () => {
			socket.emitPromise('action-recorder:session:unsubscribe', [selectedSessionId]).catch((e) => {
				console.error('Action record subscribe', e)
			})

			unsubUpdate()
		}
	}, [socket, selectedSessionId])

	const closeFinishingModal = useCallback(() => {
		setIsFinishing(false)
	}, [])
	const openFinishingModal = useCallback(() => {
		setIsFinishing(true)
	}, [])

	const actionIds = useMemo(() => sessionInfo?.actions?.map((a) => a.id) ?? [], [sessionInfo?.actions])

	return (
		<CRow className="action-recorder-panel">
			<GenericConfirmModal ref={confirmRef} />

			{isFinishing && selectedSessionId ? (
				<RecorderSessionFinishModal doClose={closeFinishingModal} sessionId={selectedSessionId} />
			) : (
				''
			)}

			<CCol xs={12} className={'row-heading'}>
				<h5>Action Recorder</h5>
				<p>
					You can use this panel to record actions as you make changes directly on a configured device. <br />
					Not many modules support this, and they don't support it for every action.
				</p>
				<div style={{ margin: -12, marginTop: 10 }}>
					{selectedSessionId && sessionInfo && (
						<RecorderSessionHeading
							confirmRef={confirmRef}
							sessionId={selectedSessionId}
							sessionInfo={sessionInfo}
							doFinish={openFinishingModal}
						/>
					)}
				</div>
			</CCol>

			{selectedSessionId ? (
				<PanelCollapseHelperProvider storageId="action_recorder" knownPanelIds={actionIds}>
					<RecorderSession sessionId={selectedSessionId} sessionInfo={sessionInfo} />
				</PanelCollapseHelperProvider>
			) : (
				<CCallout color="danger">There is no session, this looks like a bug!</CCallout>
			)}
		</CRow>
	)
}
