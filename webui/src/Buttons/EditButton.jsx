import {
	CDropdown,
	CDropdownToggle,
	CDropdownItem,
	CDropdownMenu,
	CButton,
	CButtonGroup,
	CModal,
	CModalHeader,
	CModalBody,
	CModalFooter,
	CForm,
	CFormGroup,
	CLabel,
	CInput,
	CInputCheckbox,
	CNavItem,
	CNavLink,
	CNav,
	CTabs,
} from '@coreui/react'
import { faArrowLeft, faArrowRight, faPencil, faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { ButtonPreview, dataToButtonImage } from '../Components/ButtonPreview'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import {
	KeyReceiver,
	LoadingRetryOrError,
	UserConfigContext,
	socketEmitPromise,
	SocketContext,
	MyErrorBoundary,
	FormatButtonControlId,
} from '../util'
import { ParseControlId } from '@companion/shared/ControlId.js'
import { ControlActionSetEditor } from '../Controls/ActionSetEditor'
import jsonPatch from 'fast-json-patch'

import { ButtonStyleConfig } from '../Controls/ButtonStyleConfig'
import { ControlOptionsEditor } from '../Controls/ControlOptionsEditor'
import { ControlFeedbacksEditor } from '../Controls/FeedbackEditor'
import { cloneDeep } from 'lodash-es'
import { useElementSize } from 'usehooks-ts'
import { GetStepIds } from '@companion/shared/Controls'

export function EditButton({ controlId, onKeyUp, contentHeight }) {
	const socket = useContext(SocketContext)
	const userConfig = useContext(UserConfigContext)

	const resetModalRef = useRef()

	const [previewImage, setPreviewImage] = useState(null)
	const [config, setConfig] = useState(null)
	const [runtimeProps, setRuntimeProps] = useState(null)

	const configRef = useRef()
	configRef.current = config // update the ref every render

	const [configError, setConfigError] = useState(null)

	const [reloadConfigToken, setReloadConfigToken] = useState(nanoid())

	useEffect(() => {
		setConfig(null)
		setConfigError(null)
		setPreviewImage(null)
		setRuntimeProps(null)

		socketEmitPromise(socket, 'controls:subscribe', [controlId])
			.then((config) => {
				setConfig(config?.config ?? false)
				setRuntimeProps(config?.runtime ?? {})
				setConfigError(null)
			})
			.catch((e) => {
				console.error('Failed to load bank config', e)
				setConfig(null)
				setConfigError('Failed to load bank config')
			})

		const patchConfig = (patch) => {
			setConfig((oldConfig) => {
				if (patch === false) {
					return false
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldConfig) || {}, patch).newDocument
				}
			})
		}

		const patchRuntimeProps = (patch) => {
			setRuntimeProps((oldProps) => {
				if (patch === false) {
					return {}
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldProps) || {}, patch).newDocument
				}
			})
		}

		socket.on(`controls:config-${controlId}`, patchConfig)
		socket.on(`controls:runtime-${controlId}`, patchRuntimeProps)

		const updateImage = (img) => {
			setPreviewImage(dataToButtonImage(img))
		}
		socket.on(`controls:preview-${controlId}`, updateImage)

		return () => {
			socket.off(`controls:config-${controlId}`, patchConfig)
			socket.off(`controls:runtime-${controlId}`, patchRuntimeProps)
			socket.off(`controls:preview-${controlId}`, updateImage)

			socketEmitPromise(socket, 'controls:unsubscribe', [controlId]).catch((e) => {
				console.error('Failed to unsubscribe bank config', e)
			})
		}
	}, [socket, controlId, reloadConfigToken])

	const setButtonType = useCallback(
		(newType) => {
			let show_warning = false

			const currentType = configRef.current?.type
			if (currentType === newType) {
				// No point changing style to itself
				return
			}

			if (currentType && currentType !== 'pageup' && currentType !== 'pagedown' && currentType !== 'pagenum') {
				if (newType === 'pageup' || newType === 'pagedown' || newType === 'pagenum') {
					show_warning = true
				}
			}

			const doChange = () => {
				socketEmitPromise(socket, 'controls:reset', [controlId, newType]).catch((e) => {
					console.error(`Set type failed: ${e}`)
				})
			}

			if (show_warning) {
				resetModalRef.current.show(
					`Change style`,
					`Changing to this button style will erase actions and feedbacks configured for this button - continue?`,
					'OK',
					() => {
						doChange()
					}
				)
			} else {
				doChange()
			}
		},
		[socket, controlId, configRef]
	)

	const doRetryLoad = useCallback(() => setReloadConfigToken(nanoid()), [])
	const clearButton = useCallback(() => {
		resetModalRef.current.show(
			`Clear button ${FormatButtonControlId(controlId)}`,
			`This will clear the style, feedbacks and all actions`,
			'Clear',
			() => {
				socketEmitPromise(socket, 'controls:reset', [controlId]).catch((e) => {
					console.error(`Reset failed: ${e}`)
				})
			}
		)
	}, [socket, controlId])

	const hotPressDown = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-press', [controlId, true, 'edit']).catch((e) =>
			console.error(`Hot press failed: ${e}`)
		)
	}, [socket, controlId])
	const hotPressUp = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-press', [controlId, false, 'edit']).catch((e) =>
			console.error(`Hot press failed: ${e}`)
		)
	}, [socket, controlId])
	const hotRotateLeft = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-rotate', [controlId, false]).catch((e) =>
			console.error(`Hot rotate failed: ${e}`)
		)
	}, [socket, controlId])
	const hotRotateRight = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-rotate', [controlId, true]).catch((e) =>
			console.error(`Hot rotate failed: ${e}`)
		)
	}, [socket, controlId])

	const errors = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const hasConfig = config || config === false
	const hasRuntimeProps = runtimeProps || runtimeProps === false
	const dataReady = !loadError && hasConfig && hasRuntimeProps

	const parsedId = ParseControlId(controlId)

	const [hintRef, { height: hintHeight }] = useElementSize()

	return (
		<KeyReceiver onKeyUp={onKeyUp} tabIndex={0} className="edit-button-panel">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} />
			{hasConfig && dataReady && (
				<>
					<MyErrorBoundary>
						<>
							<ButtonPreview fixedSize preview={previewImage} right={true} />
							<CDropdown className="mt-2" style={{ display: 'inline-block' }}>
								<CButtonGroup>
									{/* This could be simplified to use the split property on CDropdownToggle, but then onClick doesnt work https://github.com/coreui/coreui-react/issues/179 */}
									<CButton color="success" onClick={() => setButtonType('button')}>
										Regular button
									</CButton>
									<CDropdownToggle
										caret
										color="success"
										style={{ opacity: 0.8, paddingLeft: 6 }}
										className="dropdown-toggle dropdown-toggle-split"
									>
										<span className="sr-only">Toggle Dropdown</span>
									</CDropdownToggle>
								</CButtonGroup>
								<CDropdownMenu>
									<CDropdownItem onClick={() => setButtonType('button')}>Regular button</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pageup')}>Page up</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pagenum')}>Page number</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pagedown')}>Page down</CDropdownItem>
								</CDropdownMenu>
							</CDropdown>
							&nbsp;
							<CButton color="danger" hidden={!config} onClick={clearButton}>
								Erase
							</CButton>
							&nbsp;
							<CButtonGroup>
								<CButton
									color="warning"
									hidden={!config || config.type !== 'button'}
									onMouseDown={hotPressDown}
									onMouseUp={hotPressUp}
								>
									Test actions
								</CButton>
								{config?.options?.rotaryActions && (
									<CButton color="warning" onMouseDown={hotRotateLeft}>
										Click Left
									</CButton>
								)}
								{config?.options?.rotaryActions && (
									<CButton color="warning" onMouseDown={hotRotateRight}>
										Click Right
									</CButton>
								)}
							</CButtonGroup>
						</>
					</MyErrorBoundary>

					<MyErrorBoundary>
						<ButtonStyleConfig
							controlType={config.type}
							style={config.style}
							configRef={configRef}
							controlId={controlId}
						/>

						<ControlOptionsEditor
							controlType={config.type}
							options={config.options}
							configRef={configRef}
							controlId={controlId}
						/>
					</MyErrorBoundary>

					{config && runtimeProps && (
						<MyErrorBoundary>
							<TabsSection
								fillHeight={contentHeight - hintHeight}
								style={config.type}
								controlId={controlId}
								steps={config.steps || {}}
								runtimeProps={runtimeProps}
								rotaryActions={config?.options?.rotaryActions}
								feedbacks={config.feedbacks}
							/>
						</MyErrorBoundary>
					)}

					<div ref={hintRef} style={{ padding: '1px 0' }}>
						{parsedId?.page && parsedId?.bank && (
							<>
								<hr />
								<p>
									<b>Hint:</b> Control buttons with OSC or HTTP: /press/bank/{parsedId.page}/{parsedId.bank} to press
									this button remotely. OSC port{' '}
									<code>
										{userConfig?.osc_enabled && userConfig?.osc_listen_port && userConfig?.osc_listen_port !== '0'
											? userConfig?.osc_listen_port
											: 'disabled'}
									</code>
									!
								</p>
							</>
						)}
					</div>
				</>
			)}
		</KeyReceiver>
	)
}

function TabsSection({ fillHeight, style, controlId, steps, runtimeProps, rotaryActions, feedbacks }) {
	const socket = useContext(SocketContext)

	const confirmRef = useRef()

	const tabsScrollRef = useRef(null)
	const [tabsSizeRef, { height: tabsHeight }] = useElementSize()

	const setTabsRef = useCallback(
		(ref) => {
			tabsSizeRef(ref)
			tabsScrollRef.current = ref
		},
		[tabsSizeRef]
	)

	const clickSelectedStep = useCallback((newStep) => {
		setSelectedStep(newStep)

		if (tabsScrollRef.current) {
			tabsScrollRef.current.scrollIntoView({
				block: 'start',
				inline: 'nearest',
				behavior: 'smooth',
			})
		}
	}, [])

	const keys = GetStepIds(steps)
	const [selectedStep, setSelectedStep] = useState(keys.length ? `step:${keys[0]}` : 'feedbacks')

	useEffect(() => {
		const keys2 = keys.map((k) => `step:${k}`)
		keys2.push('feedbacks')

		if (!keys2.includes(selectedStep)) {
			setSelectedStep(keys2[0])
		}
	}, [keys, selectedStep])

	const appendStep = useCallback(
		(e) => {
			if (e) e.preventDefault()

			socketEmitPromise(socket, 'controls:step:add', [controlId])
				.then((newStep) => {
					if (newStep) {
						setSelectedStep(`step:${newStep}`)
						setTimeout(() => setSelectedStep(`step:${newStep}`), 500)
					}
				})
				.catch((e) => {
					console.error('Failed to append step:', e)
				})
		},
		[socket, controlId]
	)
	const removeStep = useCallback(
		(stepId) => {
			confirmRef.current.show('Remove step', 'Are you sure you wish to remove this step?', 'Remove', () => {
				socketEmitPromise(socket, 'controls:step:remove', [controlId, stepId]).catch((e) => {
					console.error('Failed to delete step:', e)
				})
			})
		},
		[socket, controlId]
	)
	const swapSteps = useCallback(
		(stepId1, stepId2) => {
			socketEmitPromise(socket, 'controls:step:swap', [controlId, stepId1, stepId2]).catch((e) => {
				console.error('Failed to swap steps:', e)
			})
		},
		[socket, controlId]
	)
	const setNextStep = useCallback(
		(stepId) => {
			socketEmitPromise(socket, 'controls:step:set-next', [controlId, stepId]).catch((e) => {
				console.error('Failed to set next step:', e)
			})
		},
		[socket, controlId]
	)

	const appendSet = useCallback(
		(stepId) => {
			socketEmitPromise(socket, 'controls:action-set:add', [controlId, stepId]).catch((e) => {
				console.error('Failed to append set:', e)
			})
		},
		[socket, controlId]
	)
	const removeSet = useCallback(
		(stepId, setId) => {
			confirmRef.current.show('Remove step', 'Are you sure you wish to remove this group?', 'Remove', () => {
				socketEmitPromise(socket, 'controls:action-set:remove', [controlId, stepId, setId]).catch((e) => {
					console.error('Failed to delete set:', e)
				})
			})
		},
		[socket, controlId]
	)

	if (style === 'button') {
		const selectedIndex = keys.findIndex((k) => `step:${k}` === selectedStep)
		const selectedKey = selectedIndex >= 0 && keys[selectedIndex]
		const selectedStep2 = selectedKey && steps[selectedKey]

		return (
			<>
				<GenericConfirmModal ref={confirmRef} />

				<br />

				<div ref={setTabsRef} className={'row-heading'}>
					<CTabs activeTab={selectedStep} onActiveTabChange={clickSelectedStep}>
						<CNav variant="tabs">
							{keys.map((k, i) => (
								<CNavItem key={k}>
									<CNavLink data-tab={`step:${k}`}>
										Step {i + 1}{' '}
										{runtimeProps.current_step_id === k && <FontAwesomeIcon icon={faStar} title="Next step" />}
									</CNavLink>
								</CNavItem>
							))}
							<CNavItem key="add-step">
								{/* TODO - colour */}
								<CNavLink onClick={appendStep}>
									<FontAwesomeIcon icon={faPlus} /> Add Step
								</CNavLink>
							</CNavItem>
							<CNavItem key="feedbacks">
								<CNavLink data-tab="feedbacks">Feedbacks</CNavLink>
							</CNavItem>
						</CNav>
					</CTabs>
				</div>

				<div
					className="edit-sticky-body"
					style={{
						// minHeight: `calc(${contentHeight - tabsHeight}px - 1rem`,
						'--raw-height': `${fillHeight - tabsHeight}px`,
					}}
				>
					<p></p>
					{selectedStep === 'feedbacks' && (
						<MyErrorBoundary>
							<ControlFeedbacksEditor
								heading="Feedbacks"
								controlId={controlId}
								feedbacks={feedbacks}
								isOnControl={true}
							/>
						</MyErrorBoundary>
					)}

					{selectedKey && selectedStep && (
						<>
							<CButtonGroup hidden={keys.length === 1}>
								<CButton
									key="set-next"
									color={runtimeProps.current_step_id === selectedKey ? 'success' : 'primary'}
									size="sm"
									disabled={runtimeProps.current_step_id === selectedKey}
									onClick={() => setNextStep(selectedKey)}
								>
									Set Next
								</CButton>

								<CButton
									key="move-up"
									color="warning"
									title="Move step before"
									size="sm"
									disabled={selectedIndex === 0}
									onClick={() => swapSteps(selectedKey, keys[selectedIndex - 1])}
								>
									<FontAwesomeIcon icon={faArrowLeft} />
								</CButton>
								<CButton
									key="move-down"
									color="warning"
									title="Move step after"
									size="sm"
									disabled={selectedIndex === keys.length - 1}
									onClick={() => swapSteps(selectedKey, keys[selectedIndex + 1])}
								>
									<FontAwesomeIcon icon={faArrowRight} />
								</CButton>
								<CButton
									key="delete"
									color="danger"
									title="Delete step"
									size="sm"
									disabled={keys.length === 1}
									onClick={() => removeStep(selectedKey)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</CButton>
							</CButtonGroup>

							{rotaryActions && (
								<>
									<MyErrorBoundary>
										<ControlActionSetEditor
											heading="Rotate left actions"
											controlId={controlId}
											stepId={selectedKey}
											setId="rotate_left"
											addPlaceholder="+ Add rotate left action"
											actions={selectedStep2.action_sets['rotate_left']}
										/>
									</MyErrorBoundary>

									<MyErrorBoundary>
										<ControlActionSetEditor
											heading="Rotate right actions"
											controlId={controlId}
											stepId={selectedKey}
											setId="rotate_right"
											addPlaceholder="+ Add rotate right action"
											actions={selectedStep2.action_sets['rotate_right']}
										/>
									</MyErrorBoundary>
								</>
							)}

							<MyErrorBoundary>
								<ControlActionSetEditor
									heading={`Press actions`}
									controlId={controlId}
									stepId={selectedKey}
									setId="down"
									addPlaceholder={`+ Add press action`}
									actions={selectedStep2.action_sets['down']}
								/>
							</MyErrorBoundary>

							<EditActionsRelease
								controlId={controlId}
								action_sets={selectedStep2.action_sets}
								stepOptions={selectedStep2.options}
								stepId={selectedKey}
								removeSet={removeSet}
							/>

							<br />
							<p>
								<CButton onClick={() => appendSet(selectedKey)} color="primary">
									<FontAwesomeIcon icon={faPlus} /> Add duration group
								</CButton>
							</p>
						</>
					)}
				</div>
			</>
		)
	} else {
		return ''
	}
}

function EditActionsRelease({ controlId, action_sets, stepOptions, stepId, removeSet }) {
	const socket = useContext(SocketContext)

	const editRef = useRef(null)

	const renameSet = useCallback(
		(oldId) => {
			if (editRef.current) {
				console.log(stepOptions, oldId)
				const runWhileHeld = stepOptions.runWhileHeld.includes(Number(oldId))
				editRef.current.show(Number(oldId), runWhileHeld, (newId, runWhileHeld) => {
					if (!isNaN(newId)) {
						socketEmitPromise(socket, 'controls:action-set:rename', [controlId, stepId, oldId, newId])
							.then(() => {
								socketEmitPromise(socket, 'controls:action-set:set-run-while-held', [
									controlId,
									stepId,
									newId,
									runWhileHeld,
								]).catch((e) => {
									console.error('Failed to set runWhileHeld:', e)
								})
							})
							.catch((e) => {
								console.error('Failed to rename set:', e)
							})
					}
				})
			}
		},
		[socket, controlId, stepId, stepOptions]
	)

	const candidate_sets = Object.entries(action_sets).filter(([id]) => !isNaN(id))
	candidate_sets.sort((a, b) => Number(a[0]) - Number(b[0]))

	const components = candidate_sets.map(([id, actions]) => {
		const runWhileHeld = stepOptions.runWhileHeld.includes(Number(id))
		const ident = runWhileHeld ? `Held for ${id}ms` : `Release after ${id}ms`
		return (
			<MyErrorBoundary key={id}>
				<ControlActionSetEditor
					key={id}
					heading={`${ident} actions`}
					headingActions={[
						<CButton key="rename" color="warning" title="Change time" size="sm" onClick={() => renameSet(id)}>
							<FontAwesomeIcon icon={faPencil} />
						</CButton>,
						<CButton key="delete" color="danger" title="Delete step" size="sm" onClick={() => removeSet(stepId, id)}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>,
					]}
					controlId={controlId}
					stepId={stepId}
					setId={id}
					addPlaceholder={`+ Add ${ident} action`}
					actions={actions}
				/>
			</MyErrorBoundary>
		)
	})

	return (
		<>
			<EditDurationGroupPropertiesModal ref={editRef} />

			<MyErrorBoundary>
				<ControlActionSetEditor
					heading={candidate_sets.length ? 'Short release actions' : 'Release actions'}
					controlId={controlId}
					stepId={stepId}
					setId={'up'}
					addPlaceholder={candidate_sets.length ? '+ Add key short release action' : '+ Add key release action'}
					actions={action_sets['up']}
				/>
			</MyErrorBoundary>

			{components}
		</>
	)
}

const EditDurationGroupPropertiesModal = forwardRef(function EditDurationGroupPropertiesModal(props, ref) {
	const [data, setData] = useState(null)
	const [show, setShow] = useState(false)

	const [newDurationValue, setNewDurationValue] = useState(null)
	const [newWhileHeldValue, setNewWhileHeldValue] = useState(null)

	const buttonRef = useRef()

	const buttonFocus = () => {
		if (buttonRef.current) {
			buttonRef.current.focus()
		}
	}

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setData(null), [])
	const doAction = useCallback(
		(e) => {
			if (e) e.preventDefault()

			setData(null)
			setShow(false)
			setNewDurationValue(null)
			setNewWhileHeldValue(null)

			// completion callback
			const cb = data?.[1]
			cb(newDurationValue, newWhileHeldValue)
		},
		[data, newDurationValue, newWhileHeldValue]
	)

	useImperativeHandle(
		ref,
		() => ({
			show(duration, whileHeld, completeCallback) {
				setNewDurationValue(duration)
				setNewWhileHeldValue(whileHeld)
				setData([duration, completeCallback])
				setShow(true)

				// Focus the button asap. It also gets focused once the open is complete
				setTimeout(buttonFocus, 50)
			},
		}),
		[]
	)

	const onDurationChange = useCallback((e) => {
		setNewDurationValue(Number(e.target.value))
	}, [])

	const onWhileHeldChange = useCallback((e) => {
		setNewWhileHeldValue(!!e.target.checked)
	}, [])

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
			<CModalHeader closeButton>
				<h5>Change delay group properties</h5>
			</CModalHeader>
			<CModalBody>
				<CForm onSubmit={doAction}>
					<CFormGroup>
						<CLabel>Press duration</CLabel>
						<CInput
							type="number"
							value={newDurationValue}
							min={1}
							step={1}
							style={{ color: !newDurationValue || newDurationValue <= 0 ? 'red' : undefined }}
							onChange={onDurationChange}
						/>
					</CFormGroup>

					<CFormGroup className="fieldtype-checkbox">
						<CLabel>Execute while held</CLabel>
						<CInputCheckbox type="checkbox" checked={!!newWhileHeldValue} value={true} onChange={onWhileHeldChange} />
					</CFormGroup>
				</CForm>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton innerRef={buttonRef} color="primary" onClick={doAction}>
					Save
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
