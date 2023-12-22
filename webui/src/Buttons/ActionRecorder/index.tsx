import React, { useCallback, useContext, useEffect, useState, useRef } from 'react'
import { socketEmitPromise, SocketContext, applyPatchOrReplaceObject } from '../../util'
import { CAlert, CCol, CRow } from '@coreui/react'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'
import { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { RecordSessionInfo, RecordSessionListInfo } from '@companion/shared/Model/ActionRecorderModel'
import { RecorderSessionFinishModal } from './RecorderSessionFinishModal'
import { RecorderSessionHeading, RecorderSession } from './RecorderSessionHeading'

export function ActionRecorder() {
	const socket = useContext(SocketContext)

	const confirmRef = useRef(null)

	const [sessions, setSessions] = useState<Record<string, RecordSessionListInfo | undefined> | null>(null)
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
	const [isFinishing, setIsFinishing] = useState(false)

	// Subscribe to the list of sessions
	useEffect(() => {
		socketEmitPromise(socket, 'action-recorder:subscribe', [])
			.then((newSessions) => {
				setSessions(newSessions)

				setSelectedSessionId(Object.keys(newSessions).sort()[0] || null)
				setIsFinishing(false)
			})
			.catch((e) => {
				console.error('Action record subscribe', e)
			})

		const updateSessionList = (newSessions: JsonPatchOperation[]) => {
			setSessions((oldSessions) => oldSessions && applyPatchOrReplaceObject(oldSessions, newSessions))
		}

		socket.on('action-recorder:session-list', updateSessionList)

		return () => {
			socketEmitPromise(socket, 'action-recorder:unsubscribe', []).catch((e) => {
				console.error('Action record subscribe', e)
			})

			socket.off('action-recorder:session-list', updateSessionList)
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
		socketEmitPromise(socket, 'action-recorder:session:subscribe', [selectedSessionId])
			.then((info) => {
				setSessionInfo(info)
			})
			.catch((e) => {
				console.error('Action record session subscribe', e)
			})

		const updateSessionInfo = (patch: JsonPatchOperation[]) => {
			setSessionInfo((oldInfo) => oldInfo && applyPatchOrReplaceObject(oldInfo, patch))
		}

		socket.on(`action-recorder:session:update:${selectedSessionId}`, updateSessionInfo)

		return () => {
			socketEmitPromise(socket, 'action-recorder:session:unsubscribe', [selectedSessionId]).catch((e) => {
				console.error('Action record subscribe', e)
			})

			socket.off(`action-recorder:session:update:${selectedSessionId}`, updateSessionInfo)
		}
	}, [socket, selectedSessionId])

	const closeFinishingModal = useCallback(() => {
		setIsFinishing(false)
	}, [])
	const openFinishingModal = useCallback(() => {
		setIsFinishing(true)
	}, [])

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

				{selectedSessionId && sessionInfo && (
					<RecorderSessionHeading
						confirmRef={confirmRef}
						sessionId={selectedSessionId}
						sessionInfo={sessionInfo}
						doFinish={openFinishingModal}
					/>
				)}

				<hr className="slim" />
			</CCol>
			{selectedSessionId ? (
				<RecorderSession sessionId={selectedSessionId} sessionInfo={sessionInfo} />
			) : (
				<CAlert color="danger">There is no session, this looks like a bug!</CAlert>
			)}
		</CRow>
	)
}
