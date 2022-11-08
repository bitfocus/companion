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
} from '@coreui/react'
import { faArrowDown, faArrowUp, faPencil, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { BankPreview, dataToButtonImage } from '../Components/BankButton'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import {
	KeyReceiver,
	LoadingRetryOrError,
	UserConfigContext,
	socketEmitPromise,
	ParseControlId,
	SocketContext,
	MyErrorBoundary,
	FormatButtonControlId,
} from '../util'
import { ControlActionSetEditor } from '../Controls/ActionSetEditor'
import jsonPatch from 'fast-json-patch'

import { ButtonStyleConfig } from '../Controls/ButtonStyleConfig'
import { ControlOptionsEditor } from '../Controls/ControlOptionsEditor'
import { ControlFeedbacksEditor } from '../Controls/FeedbackEditor'
import { cloneDeep } from 'lodash-es'

export function EditButton({ controlId, onKeyUp }) {
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
	const resetBank = useCallback(() => {
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

	return (
		<KeyReceiver onKeyUp={onKeyUp} tabIndex={0} className="edit-button-panel">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} />
			{hasConfig && (
				<div style={{ display: dataReady ? '' : 'none' }}>
					<MyErrorBoundary>
						<div>
							<BankPreview fixedSize preview={previewImage} right={true} />
							<CDropdown className="mt-2" style={{ display: 'inline-block' }}>
								<CButtonGroup>
									{/* This could be simplified to use the split property on CDropdownToggle, but then onClick doesnt work https://github.com/coreui/coreui-react/issues/179 */}
									<CButton color="success" onClick={() => setButtonType('press')}>
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
									<CDropdownItem onClick={() => setButtonType('press')}>Regular button</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('step')}>Step/latch button</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('timed')}>Timed button</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pageup')}>Page up</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pagenum')}>Page number</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pagedown')}>Page down</CDropdownItem>
								</CDropdownMenu>
							</CDropdown>
							&nbsp;
							<CButton color="danger" hidden={!config} onClick={resetBank}>
								Erase
							</CButton>
							&nbsp;
							<CButtonGroup>
								<CButton
									color="warning"
									hidden={!config || (config.type !== 'press' && config.type !== 'step' && config.type !== 'timed')}
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
						</div>
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
						<>
							{config.action_sets && (
								<MyErrorBoundary>
									<ActionsSection
										style={config.type}
										controlId={controlId}
										action_sets={config.action_sets}
										runtimeProps={runtimeProps}
										rotaryActions={config.options.rotaryActions}
									/>
								</MyErrorBoundary>
							)}

							{config.feedbacks && (
								<MyErrorBoundary>
									<ControlFeedbacksEditor
										heading={'Feedback'}
										controlId={controlId}
										feedbacks={config.feedbacks}
										isOnBank={true}
									/>
								</MyErrorBoundary>
							)}
						</>
					)}

					<hr />

					{parsedId?.page && parsedId?.bank && (
						<p>
							<b>Hint:</b> Control buttons with OSC or HTTP: /press/bank/{parsedId.page}/{parsedId.bank} to press this
							button remotely. OSC port{' '}
							<code>
								{userConfig?.osc_enabled && userConfig?.osc_listen_port && userConfig?.osc_listen_port !== '0'
									? userConfig?.osc_listen_port
									: 'disabled'}
							</code>
							!
						</p>
					)}
				</div>
			)}
		</KeyReceiver>
	)
}

function ActionsSection({ style, controlId, action_sets, runtimeProps, rotaryActions }) {
	const socket = useContext(SocketContext)

	const confirmRef = useRef()

	const appendStep = useCallback(() => {
		socketEmitPromise(socket, 'controls:action-set:add', [controlId]).catch((e) => {
			console.error('Failed to append set:', e)
		})
	}, [socket, controlId])
	const removeStep = useCallback(
		(id) => {
			confirmRef.current.show('Remove step', 'Are you sure you wish to remove this step?', 'Remove', () => {
				socketEmitPromise(socket, 'controls:action-set:remove', [controlId, id]).catch((e) => {
					console.error('Failed to delete set:', e)
				})
			})
		},
		[socket, controlId]
	)
	const swapSteps = useCallback(
		(id1, id2) => {
			socketEmitPromise(socket, 'controls:action-set:swap', [controlId, id1, id2]).catch((e) => {
				console.error('Failed to swap sets:', e)
			})
		},
		[socket, controlId]
	)
	const setNextStep = useCallback(
		(id) => {
			socketEmitPromise(socket, 'controls:action-set:set-next', [controlId, id]).catch((e) => {
				console.error('Failed to set next set:', e)
			})
		},
		[socket, controlId]
	)

	if (style === 'press') {
		return (
			<>
				{rotaryActions && (
					<>
						<MyErrorBoundary>
							<ControlActionSetEditor
								heading="Rotate left actions"
								controlId={controlId}
								set={'rotate_left'}
								addPlaceholder="+ Add rotate left action"
								actions={action_sets['rotate_left']}
							/>
						</MyErrorBoundary>

						<MyErrorBoundary>
							<ControlActionSetEditor
								heading="Rotate right actions"
								controlId={controlId}
								set={'rotate_right'}
								addPlaceholder="+ Add rotate right action"
								actions={action_sets['rotate_right']}
							/>
						</MyErrorBoundary>
					</>
				)}

				<MyErrorBoundary>
					<ControlActionSetEditor
						heading="Press actions"
						controlId={controlId}
						set={'down'}
						addPlaceholder="+ Add key press action"
						actions={action_sets['down']}
					/>
				</MyErrorBoundary>
				<MyErrorBoundary>
					<ControlActionSetEditor
						heading="Release actions"
						controlId={controlId}
						set={'up'}
						addPlaceholder="+ Add key release action"
						actions={action_sets['up']}
					/>
				</MyErrorBoundary>
			</>
		)
	} else if (style === 'step') {
		const keys = Object.keys(action_sets).sort()
		return (
			<>
				<GenericConfirmModal ref={confirmRef} />
				{keys.map((k, i) => (
					<MyErrorBoundary>
						<ControlActionSetEditor
							heading={`Step ${i + 1} actions`}
							headingActions={[
								<CButton
									key="set-next"
									color={runtimeProps.current_step_id === k ? 'success' : 'primary'}
									size="sm"
									disabled={runtimeProps.current_step_id === k}
									onClick={() => setNextStep(k)}
								>
									Set Next
								</CButton>,
								<CButton
									key="move-up"
									color="warning"
									title="Move step up"
									size="sm"
									disabled={i === 0}
									onClick={() => swapSteps(k, keys[i - 1])}
								>
									<FontAwesomeIcon icon={faArrowUp} />
								</CButton>,
								<CButton
									key="move-down"
									color="warning"
									title="Move step down"
									size="sm"
									disabled={i === keys.length - 1}
									onClick={() => swapSteps(k, keys[i + 1])}
								>
									<FontAwesomeIcon icon={faArrowDown} />
								</CButton>,
								<CButton
									key="delete"
									color="danger"
									title="Delete step"
									size="sm"
									disabled={keys.length === 1}
									onClick={() => removeStep(k)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</CButton>,
							]}
							key={`panel_${k}`}
							controlId={controlId}
							set={k}
							addPlaceholder={`+ Add action to step ${i + 1}`}
							actions={action_sets[k]}
						/>
					</MyErrorBoundary>
				))}
				<br />
				<p>
					<CButton onClick={appendStep} color="primary">
						<FontAwesomeIcon icon={faPlus} /> Add Step
					</CButton>
				</p>
			</>
		)
	} else if (style === 'timed') {
		return (
			<>
				<GenericConfirmModal ref={confirmRef} />

				{rotaryActions && (
					<>
						<MyErrorBoundary>
							<ControlActionSetEditor
								heading="Rotate left actions"
								controlId={controlId}
								set={'rotate_left'}
								addPlaceholder="+ Add rotate left action"
								actions={action_sets['rotate_left']}
							/>
						</MyErrorBoundary>

						<MyErrorBoundary>
							<ControlActionSetEditor
								heading="Rotate right actions"
								controlId={controlId}
								set={'rotate_right'}
								addPlaceholder="+ Add rotate right action"
								actions={action_sets['rotate_right']}
							/>
						</MyErrorBoundary>
					</>
				)}

				<MyErrorBoundary>
					<ControlActionSetEditor
						heading="Down actions"
						controlId={controlId}
						set={'down'}
						addPlaceholder="+ Add key down action"
						actions={action_sets['down']}
					/>
				</MyErrorBoundary>

				<EditActionsTimed controlId={controlId} action_sets={action_sets} removeStep={removeStep} />

				<br />
				<p>
					<CButton onClick={appendStep} color="primary">
						<FontAwesomeIcon icon={faPlus} /> Add duration group
					</CButton>
				</p>
			</>
		)
	} else {
		return ''
	}
}

function EditActionsTimed({ controlId, action_sets, removeStep }) {
	const socket = useContext(SocketContext)

	const editRef = useRef(null)

	const renameStep = useCallback(
		(oldId) => {
			if (editRef.current) {
				editRef.current.show(Number(oldId), (newId) => {
					if (!isNaN(newId)) {
						socketEmitPromise(socket, 'controls:action-set:rename', [controlId, oldId, newId]).catch((e) => {
							console.error('Failed to rename set:', e)
						})
					}
				})
			}
		},
		[socket, controlId]
	)

	const candidate_sets = Object.entries(action_sets).filter(([id]) => !isNaN(id))
	candidate_sets.sort((a, b) => Number(a[0]) - Number(b[0]))

	const components = candidate_sets.map(([id, actions]) => {
		const isShort = id === '0'
		const ident = isShort ? 'Short release' : `Release after ${id}ms`
		return (
			<MyErrorBoundary key={id}>
				<ControlActionSetEditor
					key={id}
					heading={`${ident} actions`}
					headingActions={
						!isShort && [
							<CButton key="rename" color="warning" title="Change time" size="sm" onClick={() => renameStep(id)}>
								<FontAwesomeIcon icon={faPencil} />
							</CButton>,

							<CButton
								key="delete"
								color="danger"
								title="Delete step"
								size="sm"
								disabled={candidate_sets.length === 1}
								onClick={() => removeStep(id)}
							>
								<FontAwesomeIcon icon={faTrash} />
							</CButton>,
						]
					}
					controlId={controlId}
					set={id}
					addPlaceholder={`+ Add ${ident} action`}
					actions={actions}
				/>
			</MyErrorBoundary>
		)
	})

	return (
		<>
			<EditDurationModal ref={editRef} />

			{components}
		</>
	)
}

const EditDurationModal = forwardRef(function EditDurationModal(props, ref) {
	const [data, setData] = useState(null)
	const [show, setShow] = useState(false)

	const [newValue, setNewValue] = useState(null)

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
			setNewValue(null)

			// completion callback
			const cb = data?.[1]
			cb(newValue)
		},
		[data, newValue]
	)

	useImperativeHandle(
		ref,
		() => ({
			show(duration, completeCallback) {
				setNewValue(duration)
				setData([duration, completeCallback])
				setShow(true)

				// Focus the button asap. It also gets focused once the open is complete
				setTimeout(buttonFocus, 50)
			},
		}),
		[]
	)

	const onChange = useCallback((e) => {
		setNewValue(Number(e.target.value))
	}, [])

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
			<CModalHeader closeButton>
				<h5>Change press duration</h5>
			</CModalHeader>
			<CModalBody>
				<CForm onSubmit={doAction}>
					<CFormGroup>
						<CLabel>New press duration</CLabel>
						<CInput
							type="number"
							value={newValue}
							min={1}
							step={1}
							style={{ color: !newValue || newValue <= 0 ? 'red' : undefined }}
							onChange={onChange}
						/>
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
