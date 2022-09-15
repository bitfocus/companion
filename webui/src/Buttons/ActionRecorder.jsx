import React, { useCallback, useContext, useEffect, useState } from 'react'
import {
	InstancesContext,
	socketEmitPromise,
	SocketContext,
	LoadingRetryOrError,
	applyPatchOrReplaceObject,
} from '../util'
import { CButton, CAlert, CButtonGroup, CSwitch } from '@coreui/react'
import { useMemo } from 'react'
import { DropdownInputField } from '../Components'
import { ActionsPanelInner } from './EditButton/ActionsPanel'

export function ActionRecorder() {
	const socket = useContext(SocketContext)

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

	return (
		<>
			<h5>Action Recorder</h5>
			<p>
				You can use this panel to record actions as you make changes directly on a configured device. <br />
				Only a few modules support this, and they don't support it for every action.
			</p>

			{selectedSessionId ? (
				<RecorderSession sessionId={selectedSessionId} />
			) : (
				<CAlert color="danger">There is no session, this looks like a bug!</CAlert>
			)}
		</>
	)
}

function RecorderSession({ sessionId }) {
	const socket = useContext(SocketContext)
	const instances = useContext(InstancesContext)

	const [sessionInfo, setSessionInfo] = useState(null)

	useEffect(() => {
		setSessionInfo(null)

		socketEmitPromise(socket, 'action-recorder:session:subscribe', [sessionId])
			.then((info) => {
				setSessionInfo(info)
			})
			.catch((e) => {
				console.error('Action record session subscribe', e)
			})

		const updateSessionInfo = (patch) => {
			setSessionInfo((oldInfo) => applyPatchOrReplaceObject(oldInfo, patch))
		}

		socket.on(`action-recorder:session:update:${sessionId}`, updateSessionInfo)

		return () => {
			socketEmitPromise(socket, 'action-recorder:session:unsubscribe', [sessionId]).catch((e) => {
				console.error('Action record subscribe', e)
			})

			socket.off(`action-recorder:session:update:${sessionId}`, updateSessionInfo)
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
			if (info.hasRecordActionsHandler || true) {
				result.push({
					id,
					label: info.label,
				})
			}
		}

		return result
	}, [instances])

	const doClearActions = useCallback(() => {
		socketEmitPromise(socket, 'action-recorder:session:discard-actions', [sessionId]).catch((e) => {
			console.error(e)
		})
	}, [socket, sessionId])

	const doAbort = useCallback(() => {
		socketEmitPromise(socket, 'action-recorder:session:abort', [sessionId]).catch((e) => {
			console.error(e)
		})
	}, [socket, sessionId])

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
		<>
			<h3>
				Record: <CSwitch color="primary" checked={!!sessionInfo.isRunning} onChange={changeRecording} />
			</h3>
			<h3>
				Instances:
				<DropdownInputField
					value={sessionInfo.instanceIds}
					setValue={changeInstanceIds}
					multiple={true}
					definition={{ choices: instancesWhichCanRecord, default: [] }}
				/>
			</h3>
			{/* <CButtonGroup>{sessionInfo.isRunning ? <CButton>Pause</CButton> : <CButton>Record</CButton>}</CButtonGroup> */}
			<p>There are {sessionInfo.actions.length} actions</p>

			<ActionsPanelInner
				isOnBank={false}
				dragId={'triggerAction'}
				actions={sessionInfo.actions || []}
				readonly={!!sessionInfo.isRunning}
				doDelete={doActionDelete}
				doSetDelay={doActionDelay}
				doReorder={doActionReorder}
				doSetValue={doActionSetValue}
			/>

			<div>
				<CButtonGroup>
					<CButton onClick={doClearActions} color="warning">
						Clear Actions
					</CButton>
					<CButton onClick={doAbort} color="danger">
						Reset
					</CButton>
				</CButtonGroup>
			</div>
		</>
	)
}
