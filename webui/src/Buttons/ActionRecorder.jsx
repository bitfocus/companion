import React, { useCallback, useContext, useEffect, useState, useRef } from 'react'
import {
	InstancesContext,
	socketEmitPromise,
	SocketContext,
	LoadingRetryOrError,
	applyPatchOrReplaceObject,
} from '../util'
import { CButton, CAlert, CButtonGroup, CSwitch, CCol, CRow, CForm, CLabel } from '@coreui/react'
import { useMemo } from 'react'
import { DropdownInputField } from '../Components'
import { ActionsPanelInner } from './EditButton/ActionsPanel'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'

export function ActionRecorder() {
	const socket = useContext(SocketContext)

	const confirmRef = useRef(null)

	const [sessions, setSessions] = useState(null)
	const [selectedSessionId, setSelectedSessionId] = useState(null)

	// Subscribe to the list of sessions
	useEffect(() => {
		socketEmitPromise(socket, 'action-recorder:subscribe', [])
			.then((newSessions) => {
				setSessions(newSessions)

				setSelectedSessionId(Object.keys(newSessions).sort()[0] || null)
			})
			.catch((e) => {
				console.error('Action record subscribe', e)
			})

		const updateSessionList = (newSessions) => {
			setSessions((oldSessions) => applyPatchOrReplaceObject(oldSessions, newSessions))
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
			return sessions && sessions[oldId] ? oldId : Object.keys(sessions || {}).sort()[0] || null
		})
	}, [sessions])

	const [sessionInfo, setSessionInfo] = useState(null)

	useEffect(() => {
		setSessionInfo(null)

		if (selectedSessionId) {
			socketEmitPromise(socket, 'action-recorder:session:subscribe', [selectedSessionId])
				.then((info) => {
					setSessionInfo(info)
				})
				.catch((e) => {
					console.error('Action record session subscribe', e)
				})

			const updateSessionInfo = (patch) => {
				setSessionInfo((oldInfo) => applyPatchOrReplaceObject(oldInfo, patch))
			}

			socket.on(`action-recorder:session:update:${selectedSessionId}`, updateSessionInfo)

			return () => {
				socketEmitPromise(socket, 'action-recorder:session:unsubscribe', [selectedSessionId]).catch((e) => {
					console.error('Action record subscribe', e)
				})

				socket.off(`action-recorder:session:update:${selectedSessionId}`, updateSessionInfo)
			}
		}
	}, [socket, selectedSessionId])

	return (
		<CRow className="action-recorder-panel">
			<GenericConfirmModal ref={confirmRef} />

			<CCol xs={12} className={'row-heading'}>
				<h5>Action Recorder</h5>
				<p>
					You can use this panel to record actions as you make changes directly on a configured device. <br />
					Only a few modules support this, and they don't support it for every action.
				</p>

				<RecorderSessionHeading confirmRef={confirmRef} sessionId={selectedSessionId} sessionInfo={sessionInfo} />

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

function RecorderSessionHeading({ confirmRef, sessionId, sessionInfo }) {
	const socket = useContext(SocketContext)
	const instances = useContext(InstancesContext)

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
	}, [socket, sessionId])

	const changeRecording = useCallback(
		(e) => {
			socketEmitPromise(socket, 'action-recorder:session:recording', [sessionId, e.target.checked]).catch((e) => {
				console.error(e)
			})
		},
		[socket, sessionId]
	)

	const changeInstanceIds = useCallback(
		(ids) => {
			socketEmitPromise(socket, 'action-recorder:session:set-instances', [sessionId, ids]).catch((e) => {
				console.error(e)
			})
		},
		[socket, sessionId]
	)

	const instancesWhichCanRecord = useMemo(() => {
		const result = []

		for (const [id, info] of Object.entries(instances)) {
			if (info.hasRecordActionsHandler) {
				result.push({
					id,
					label: info.label,
				})
			}
		}

		return result
	}, [instances])

	if (!sessionInfo) return <></>

	return (
		<>
			<CForm className="edit-button-panel">
				<CRow form>
					<CCol className="fieldtype-checkbox" sm={10} xs={9}>
						<CLabel>Connections</CLabel>
						<DropdownInputField
							value={sessionInfo.instanceIds}
							setValue={changeInstanceIds}
							multiple={true}
							definition={{ choices: instancesWhichCanRecord, default: [] }}
						/>
					</CCol>

					<CCol className="fieldtype-checkbox" sm={2} xs={3}>
						<CLabel>Recording</CLabel>
						<p>
							<CSwitch color="primary" size="lg" checked={!!sessionInfo.isRunning} onChange={changeRecording} />
						</p>
					</CCol>
				</CRow>
			</CForm>
			<CButtonGroup className={'margin-bottom'}>
				<CButton onClick={doClearActions} color="warning">
					Clear Actions
				</CButton>
				<CButton onClick={doAbort} color="danger">
					Discard
				</CButton>
			</CButtonGroup>
		</>
	)
}

function RecorderSession({ sessionId, sessionInfo }) {
	const socket = useContext(SocketContext)

	const doActionDelete = useCallback(
		(actionId) => {
			socketEmitPromise(socket, 'action-recorder:session:action-delete', [sessionId, actionId]).catch((e) => {
				console.error(e)
			})
		},
		[socket, sessionId]
	)
	const doActionDelay = useCallback(
		(actionId, delay) => {
			socketEmitPromise(socket, 'action-recorder:session:action-delay', [sessionId, actionId, delay]).catch((e) => {
				console.error(e)
			})
		},
		[socket, sessionId]
	)
	const doActionSetValue = useCallback(
		(actionId, key, value) => {
			socketEmitPromise(socket, 'action-recorder:session:action-set-value', [sessionId, actionId, key, value]).catch(
				(e) => {
					console.error(e)
				}
			)
		},
		[socket, sessionId]
	)
	const doActionReorder = useCallback(
		(dragIndex, hoverIndex) => {
			socketEmitPromise(socket, 'action-recorder:session:action-reorder', [sessionId, dragIndex, hoverIndex]).catch(
				(e) => {
					console.error(e)
				}
			)
		},
		[socket, sessionId]
	)

	if (!sessionInfo || !sessionInfo.actions) return <LoadingRetryOrError dataReady={false} />

	return (
		<CCol xs={12}>
			<ActionsPanelInner
				isOnBank={false}
				dragId={'triggerAction'}
				actions={sessionInfo.actions}
				readonly={!!sessionInfo.isRunning}
				doDelete={doActionDelete}
				doSetDelay={doActionDelay}
				doReorder={doActionReorder}
				doSetValue={doActionSetValue}
			/>
			{sessionInfo.actions.length === 0 ? <CAlert color="info">No actions have been recorded</CAlert> : ''}
		</CCol>
	)
}
