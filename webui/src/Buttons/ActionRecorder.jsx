import React, { useCallback, useContext, useEffect, useState, useRef } from 'react'
import {
	InstancesContext,
	socketEmitPromise,
	SocketContext,
	LoadingRetryOrError,
	applyPatchOrReplaceObject,
	PagesContext,
	TriggersContext,
	PreventDefaultHandler,
	UserConfigContext,
} from '../util'
import { CreateTriggerControlId } from '@companion/shared/ControlId'
import {
	CButton,
	CAlert,
	CButtonGroup,
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
import { faCalendarAlt, faClock, faHome } from '@fortawesome/free-solid-svg-icons'
import { useMemo } from 'react'
import { DropdownInputField } from '../Components'
import { ActionsList } from '../Controls/ActionSetEditor'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { ButtonGridHeader } from './ButtonGridHeader'
import { usePagePicker } from '../Hooks/usePagePicker'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'
import CSwitch from '../CSwitch'
import { MenuPortalContext } from '../Components/DropdownInputField'
import { ButtonGridIcon, ButtonInfiniteGrid } from './ButtonInfiniteGrid'
import { useHasBeenRendered } from '../Hooks/useHasBeenRendered'

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

	const doSave = useCallback(
		(controlId, stepId, setId, mode) => {
			socketEmitPromise(socket, 'action-recorder:session:save-to-control', [sessionId, controlId, stepId, setId, mode])
				.then(() => {
					doClose()
				})
				.catch((e) => {
					console.error(e)
				})
		},
		[socket, sessionId, doClose]
	)

	const [modalRef, setModalRef] = useState(null)

	return (
		<CModal innerRef={setModalRef} show={true} onClose={doClose} size="lg" className="modal-full-height" scrollable>
			<MenuPortalContext.Provider value={modalRef}>
				<CForm onSubmit={PreventDefaultHandler} className={'action-recorder-finish-panel'}>
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
							<CTabContent fade={false} className="default-scroll">
								<CTabPane data-tab="buttons" className="action-recorder-finish-button-grid">
									<ButtonPicker selectButton={doSave} />
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
			</MenuPortalContext.Provider>
		</CModal>
	)
}

function ButtonPicker({ selectButton }) {
	const socket = useContext(SocketContext)
	const pages = useContext(PagesContext)
	const userConfig = useContext(UserConfigContext)

	const { pageNumber, setPageNumber, changePage } = usePagePicker(pages, 1)

	const [selectedLocation, setSelectedLocation] = useState(null)
	const [selectedStep, setSelectedStep] = useState(null)
	const [selectedSet, setSelectedSet] = useState(null)

	const bankClick = useCallback(
		(location, pressed) => {
			if (pressed) setSelectedLocation(location)
		},
		[pages[pageNumber]]
	)

	const selectedControl = useMemo(() => {
		return selectedLocation ? pages[pageNumber]?.controls?.[selectedLocation.row]?.[selectedLocation.column] : undefined
	}, [selectedLocation, pages[pageNumber]])

	// Reset set when control is changed
	useEffect(() => setSelectedSet(null), [selectedControl])

	const replaceActions = useCallback(() => {
		selectButton(selectedControl, selectedStep, selectedSet, 'replace')
	}, [selectedControl, selectedStep, selectedSet, selectButton])
	const appendActions = useCallback(() => {
		selectButton(selectedControl, selectedStep, selectedSet, 'append')
	}, [selectedControl, selectedStep, selectedSet, selectButton])

	const [controlInfo, setControlInfo] = useState(null)
	useEffect(() => {
		setControlInfo(null)

		if (selectedControl) {
			socketEmitPromise(socket, 'controls:subscribe', [selectedControl])
				.then((config) => {
					console.log(config)
					setControlInfo(config?.config ?? false)
				})
				.catch((e) => {
					console.error('Failed to load bank config', e)
					setControlInfo(null)
				})

			const patchConfig = (patch) => {
				setControlInfo((oldConfig) => {
					if (patch === false) {
						return false
					} else {
						return jsonPatch.applyPatch(cloneDeep(oldConfig) || {}, patch).newDocument
					}
				})
			}

			socket.on(`controls:config-${selectedControl}`, patchConfig)

			return () => {
				socket.off(`controls:config-${selectedControl}`, patchConfig)

				socketEmitPromise(socket, 'controls:unsubscribe', [selectedControl]).catch((e) => {
					console.error('Failed to unsubscribe bank config', e)
				})
			}
		}
	}, [socket, selectedControl])

	const actionStepOptions = useMemo(() => {
		switch (controlInfo?.type) {
			case 'button':
				return Object.keys(controlInfo.steps || {}).map((stepId) => ({
					id: stepId,
					label: `Step ${Number(stepId) + 1}`,
				}))
			default:
				return []
		}
	}, [controlInfo?.type, controlInfo?.steps])

	const selectedStepInfo = controlInfo?.steps?.[selectedStep]
	const actionSetOptions = useMemo(() => {
		switch (controlInfo?.type) {
			case 'button': {
				const sets = [
					{
						id: 'down',
						label: 'Press',
					},
					{
						id: 'up',
						label: 'Release',
					},
				]

				if (selectedStepInfo?.action_sets?.['rotate_left'] || selectedStepInfo?.action_sets?.['rotate_right']) {
					sets.unshift(
						{
							id: 'rotate_left',
							label: 'Rotate left',
						},
						{
							id: 'rotate_right',
							label: 'Rotate right',
						}
					)
				}

				const candidate_sets = Object.keys(selectedStepInfo?.action_sets || {}).filter((id) => !isNaN(id))
				candidate_sets.sort((a, b) => Number(a) - Number(b))

				for (const set of candidate_sets) {
					sets.push({
						id: set,
						label: `Release after ${set}ms`,
					})
				}

				return sets
			}
			default:
				return []
		}
	}, [controlInfo?.type, selectedStepInfo])

	useEffect(() => {
		setSelectedStep((oldStep) => {
			if (actionStepOptions.find((opt) => opt.id === oldStep)) {
				return oldStep
			} else {
				return actionStepOptions[0]?.id
			}
		})
	}, [actionStepOptions])

	useEffect(() => {
		setSelectedSet((oldSet) => {
			if (actionSetOptions.find((opt) => opt.id === oldSet)) {
				return oldSet
			} else {
				return actionSetOptions[0]?.id
			}
		})
	}, [actionSetOptions])

	const gridSize = userConfig.gridSize

	const [hasBeenInView, isInViewRef] = useHasBeenRendered()

	const gridRef = useRef(null)
	const resetPosition = useCallback(() => {
		gridRef.current?.resetPosition()
	}, [gridRef])

	return (
		<>
			<div>
				<CButton
					color="light"
					style={{
						float: 'right',
						marginTop: 10,
					}}
					onClick={resetPosition}
				>
					<FontAwesomeIcon icon={faHome} /> Home Position
				</CButton>

				<ButtonGridHeader pageNumber={pageNumber} changePage={changePage} setPage={setPageNumber} />
			</div>
			<div className="bankgrid" ref={isInViewRef}>
				{hasBeenInView && (
					<ButtonInfiniteGrid
						ref={gridRef}
						bankClick={bankClick}
						pageNumber={pageNumber}
						selectedButton={selectedLocation}
						gridSize={gridSize}
						buttonIconFactory={ButtonGridIcon}
					/>
				)}
			</div>
			<div>
				<CForm className="flex-form" onSubmit={PreventDefaultHandler}>
					<CRow form>
						<CCol sm={10} xs={9} hidden={actionStepOptions.length <= 1}>
							<CLabel>Step</CLabel>

							<DropdownInputField
								choices={actionStepOptions}
								multiple={false}
								value={selectedStep}
								setValue={setSelectedStep}
								disabled={!controlInfo}
							/>
						</CCol>
						<CCol sm={10} xs={9} hidden={actionSetOptions.length === 0}>
							<CLabel>Action Group</CLabel>

							<DropdownInputField
								choices={actionSetOptions}
								multiple={false}
								value={selectedSet}
								setValue={setSelectedSet}
								disabled={!controlInfo}
							/>
						</CCol>
						<CCol className="py-1" sm={10} xs={9}>
							<CButtonGroup>
								<CButton
									color="primary"
									title="Replace all the actions on the trigger"
									disabled={!selectedControl || !selectedSet}
									onClick={replaceActions}
								>
									Replace
								</CButton>
								<CButton
									color="info"
									title="Append to the existing actions"
									disabled={!selectedControl || !selectedSet}
									onClick={appendActions}
								>
									Append
								</CButton>
							</CButtonGroup>
						</CCol>
					</CRow>
				</CForm>
			</div>
		</>
	)
}

function TriggerPickerRow({ id, trigger, selectTrigger }) {
	const replaceActions = useCallback(() => selectTrigger(id, 'replace'), [id, selectTrigger])
	const appendActions = useCallback(() => selectTrigger(id, 'append'), [id, selectTrigger])

	return (
		<tr>
			<td>{trigger.name}</td>
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
		(id, mode) => selectControl(CreateTriggerControlId(id), null, null, mode),
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
						Object.entries(triggersList).map(([id, item]) => (
							<TriggerPickerRow key={id} id={id} trigger={item} selectTrigger={selectTrigger} />
						))
					) : (
						<tr>
							<td colSpan="2" className="currentlyNone">
								There currently are no triggers or scheduled tasks.
							</td>
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
			<CForm onSubmit={PreventDefaultHandler}>
				<CRow form className="flex-form flex-form-row" style={{ clear: 'both' }}>
					<div className="flex w-full gap-2">
						<div className="w-full">
							<CLabel>Connections</CLabel>
							<DropdownInputField
								value={sessionInfo.instanceIds}
								setValue={changeInstanceIds}
								multiple={true}
								choices={instancesWhichCanRecord}
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
	const doActionDuplicate = useCallback(
		(actionId) => {
			socketEmitPromise(socket, 'action-recorder:session:action-duplicate', [sessionId, actionId]).catch((e) => {
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
		(_dragStepId, _dragSetId, dragIndex, _dropStepId, _dropSetId, dropIndex) => {
			socketEmitPromise(socket, 'action-recorder:session:action-reorder', [sessionId, dragIndex, dropIndex]).catch(
				(e) => {
					console.error(e)
				}
			)
		},
		[socket, sessionId]
	)

	const { setPanelCollapsed, isPanelCollapsed } = usePanelCollapseHelper(
		`action_recorder`,
		sessionInfo?.actions?.map((a) => a.id) ?? []
	)

	if (!sessionInfo || !sessionInfo.actions) return <LoadingRetryOrError dataReady={false} />

	return (
		<CCol xs={12} className="flex-form">
			<ActionsList
				location={undefined}
				dragId={'triggerAction'}
				actions={sessionInfo.actions}
				readonly={!!sessionInfo.isRunning}
				doDelete={doActionDelete}
				doDuplicate={doActionDuplicate}
				doSetDelay={doActionDelay}
				doReorder={doActionReorder}
				doSetValue={doActionSetValue}
				setPanelCollapsed={setPanelCollapsed}
				isPanelCollapsed={isPanelCollapsed}
			/>
			{sessionInfo.actions.length === 0 ? <CAlert color="info">No actions have been recorded</CAlert> : ''}
		</CCol>
	)
}
