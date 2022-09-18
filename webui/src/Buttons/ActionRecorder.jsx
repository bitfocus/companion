import React, { useCallback, useContext, useEffect, useState, useRef } from 'react'
import {
	InstancesContext,
	socketEmitPromise,
	SocketContext,
	LoadingRetryOrError,
	applyPatchOrReplaceObject,
	PagesContext,
	TriggersContext,
	CreateTriggerControlId,
} from '../util'
import {
	CButton,
	CAlert,
	CButtonGroup,
	CSwitch,
	CCol,
	CRow,
	CForm,
	CLabel,
	CModal,
	CModalHeader,
	CModalBody,
	CModalFooter,
	CNav,
	CNavItem,
	CNavLink,
	CTabs,
	CTabContent,
	CTabPane,
} from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarAlt, faClock } from '@fortawesome/free-solid-svg-icons'
import { useMemo } from 'react'
import { DropdownInputField } from '../Components'
import { ActionsPanelInner } from './EditButton/ActionsPanel'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { ButtonGrid, ButtonGridHeader } from './ButtonGrid'

export function ActionRecorder() {
	const socket = useContext(SocketContext)

	const confirmRef = useRef(null)

	const [sessions, setSessions] = useState(null)
	const [selectedSessionId, setSelectedSessionId] = useState(null)
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

	useEffect(() => {
		setIsFinishing(false)
	}, [selectedSessionId])

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

	const closeFinishingModal = useCallback(() => {
		setIsFinishing(false)
	}, [])
	const openFinishingModal = useCallback(() => {
		setIsFinishing(true)
	}, [])

	return (
		<CRow className="action-recorder-panel">
			<GenericConfirmModal ref={confirmRef} />

			{isFinishing ? <RecorderSessionFinishModal doClose={closeFinishingModal} sessionId={selectedSessionId} /> : ''}

			<CCol xs={12} className={'row-heading'}>
				<h5>Action Recorder</h5>
				<p>
					You can use this panel to record actions as you make changes directly on a configured device. <br />
					Not many modules support this, and they don't support it for every action.
				</p>

				<RecorderSessionHeading
					confirmRef={confirmRef}
					sessionId={selectedSessionId}
					sessionInfo={sessionInfo}
					doFinish={openFinishingModal}
				/>

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

function RecorderSessionFinishModal({ doClose, sessionId }) {
	const socket = useContext(SocketContext)
	const pages = useContext(PagesContext)
	const pagesRef = useRef()

	useEffect(() => {
		// Avoid binding into callbacks
		pagesRef.current = pages
	}, [pages])

	const blockAction = useCallback((e) => {
		e.preventDefault()
	}, [])

	const doSave = useCallback(
		(controlId, setId, mode) => {
			socketEmitPromise(socket, 'action-recorder:session:save-to-control', [sessionId, controlId, mode])
				.then(() => {
					doClose()
				})
				.catch((e) => {
					console.error(e)
				})
		},
		[socket, sessionId, doClose]
	)

	const [pageNumber, setPageNumber] = useState(1)
	const changePage = useCallback((delta) => {
		setPageNumber((pageNumber) => {
			const pageNumbers = Object.keys(pagesRef.current || {})
			const currentIndex = pageNumbers.findIndex((p) => p === pageNumber + '')
			let newPage = pageNumbers[0]
			if (currentIndex !== -1) {
				let newIndex = currentIndex + delta
				if (newIndex < 0) newIndex += pageNumbers.length
				if (newIndex >= pageNumbers.length) newIndex -= pageNumbers.length

				newPage = pageNumbers[newIndex]
			}

			return newPage ?? pageNumber
		})
	}, [])

	return (
		<CModal show={true} onClose={doClose} size="lg">
			<CForm onSubmit={blockAction} className={'action-recorder-finish-panel'}>
				<CModalHeader closeButton>
					<h5>Select destination</h5>
				</CModalHeader>
				<CModalBody>
					<CTabs activeTab="buttons">
						<CNav variant="tabs">
							<CNavItem>
								<CNavLink data-tab="buttons">
									<FontAwesomeIcon icon={faCalendarAlt} /> Buttons
								</CNavLink>
							</CNavItem>
							<CNavItem>
								<CNavLink data-tab="triggers">
									<FontAwesomeIcon icon={faClock} /> Triggers
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent fade={false}>
							<CTabPane data-tab="buttons">
								<CRow>
									<CCol sm={12}>
										<ButtonGridHeader
											pageNumber={pageNumber}
											pageName={pages[pageNumber]?.name ?? 'PAGE'}
											changePage={changePage}
											setPage={setPageNumber}
										/>
									</CCol>
								</CRow>
								<CRow className="bankgrid">
									<ButtonGrid bankClick={() => {}} pageNumber={pageNumber} selectedButton={null} />
								</CRow>
							</CTabPane>
							<CTabPane data-tab="triggers">
								<CRow>
									<CCol sm={12}>
										<TriggerPicker selectControl={doSave} />
									</CCol>
								</CRow>
							</CTabPane>
						</CTabContent>
					</CTabs>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
				</CModalFooter>
			</CForm>
		</CModal>
	)
}

function TriggerPickerRow({ trigger, selectTrigger }) {
	const replaceActions = useCallback(() => {
		selectTrigger(trigger.id, 'replace')
	}, [trigger.id, selectTrigger])
	const appendActions = useCallback(() => {
		selectTrigger(trigger.id, 'append')
	}, [trigger.id, selectTrigger])

	return (
		<tr key={trigger.id}>
			<td>{trigger.title}</td>
			<td>
				<CButtonGroup>
					<CButton color="primary" title="Replace all the actions on the trigger" onClick={replaceActions}>
						Replace
					</CButton>
					<CButton color="info" title="Append to the existing actions" onClick={appendActions}>
						Append
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
}
function TriggerPicker({ selectControl }) {
	const triggersList = useContext(TriggersContext)

	const selectTrigger = useCallback(
		(id, mode) => selectControl(CreateTriggerControlId(id), null, mode),
		[selectControl]
	)

	return (
		<>
			<table className="table table-responsive-sm width-100">
				<thead>
					<tr>
						<th>Name</th>
						<th className="fit">&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{triggersList && Object.keys(triggersList).length > 0 ? (
						Object.values(triggersList).map((item) => <TriggerPickerRow trigger={item} selectTrigger={selectTrigger} />)
					) : (
						<tr>
							<td colSpan="2">There currently are no triggers or scheduled tasks.</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	)
}

function RecorderSessionHeading({ confirmRef, sessionId, sessionInfo, doFinish }) {
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
	}, [socket, sessionId, confirmRef])

	const changeRecording = useCallback(
		(e) => {
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
				<CButton onClick={doClearActions} color="warning" disabled={!sessionInfo.actions?.length}>
					Clear Actions
				</CButton>
				<CButton onClick={doAbort} color="danger">
					Discard
				</CButton>
				<CButton onClick={doFinish2} color="success" disabled={!sessionInfo.actions?.length}>
					Finish
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
