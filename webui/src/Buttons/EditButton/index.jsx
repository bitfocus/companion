import { CDropdown, CDropdownToggle, CDropdownItem, CDropdownMenu, CButton, CButtonGroup } from '@coreui/react'
import { faArrowDown, faArrowUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { BankPreview, dataToButtonImage } from '../../Components/BankButton'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'
import {
	StaticContext,
	KeyReceiver,
	LoadingRetryOrError,
	UserConfigContext,
	socketEmit2,
	ParseControlId,
} from '../../util'
import { ActionsPanel } from './ActionsPanel'
import jsonPatch from 'fast-json-patch'

import { ButtonOptionsConfig, ButtonStyleConfig } from './ButtonStyleConfig'
import { FeedbacksPanel } from './FeedbackPanel'
import { cloneDeep } from 'lodash-es'

export function EditButton({ controlId, onKeyUp }) {
	const context = useContext(StaticContext)
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

		socketEmit2(context.socket, 'controls:subscribe', [controlId])
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

		context.socket.on(`controls:config-${controlId}`, patchConfig)
		context.socket.on(`controls:runtime-${controlId}`, patchRuntimeProps)

		const updateImage = (img) => {
			setPreviewImage(dataToButtonImage(img))
		}
		context.socket.on(`controls:preview-${controlId}`, updateImage)

		return () => {
			context.socket.off(`controls:config-${controlId}`, patchConfig)
			context.socket.off(`controls:runtime-${controlId}`, patchRuntimeProps)
			context.socket.off(`controls:preview-${controlId}`, updateImage)

			socketEmit2(context.socket, 'controls:unsubscribe', [controlId]).catch((e) => {
				console.error('Failed to unsubscribe bank config', e)
			})
		}
	}, [context.socket, controlId, reloadConfigToken])

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
				socketEmit2(context.socket, 'controls:reset', [controlId, newType]).catch((e) => {
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
		[context.socket, controlId, configRef]
	)

	const doRetryLoad = useCallback(() => setReloadConfigToken(nanoid()), [])
	const resetBank = useCallback(() => {
		const parsedId = ParseControlId(controlId) // TODO
		resetModalRef.current.show(
			`Clear button ${parsedId?.page}.${parsedId?.bank}`,
			`This will clear the style, feedbacks and all actions`,
			'Clear',
			() => {
				socketEmit2(context.socket, 'controls:reset', [controlId]).catch((e) => {
					console.error(`Reset failed: ${e}`)
				})
			}
		)
	}, [context.socket, controlId])

	const hotPressDown = useCallback(() => {
		socketEmit2(context.socket, 'controls:hot-press', [controlId, true]).catch((e) =>
			console.error(`Hot press failed: ${e}`)
		)
	}, [context.socket, controlId])
	const hotPressUp = useCallback(() => {
		socketEmit2(context.socket, 'controls:hot-press', [controlId, false]).catch((e) =>
			console.error(`Hot press failed: ${e}`)
		)
	}, [context.socket, controlId])

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
			{hasConfig ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
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
								<CDropdownItem onClick={() => setButtonType('step')}>Step/latch</CDropdownItem>
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
						<CButton
							color="warning"
							hidden={!config || (config.type !== 'press' && config.type !== 'step')}
							onMouseDown={hotPressDown}
							onMouseUp={hotPressUp}
						>
							Test actions
						</CButton>
					</div>

					<ButtonStyleConfig
						controlType={config.type}
						style={config.style}
						configRef={configRef}
						controlId={controlId}
					/>

					<ButtonOptionsConfig
						controlType={config.type}
						options={config.options}
						configRef={configRef}
						controlId={controlId}
					/>

					{config && runtimeProps ? (
						<>
							{config.action_sets ? (
								<ActionsSection
									style={config.type}
									controlId={controlId}
									action_sets={config.action_sets}
									runtimeProps={runtimeProps}
								/>
							) : (
								''
							)}

							{config.feedbacks ? (
								<>
									<h4 className="mt-3">Feedback</h4>
									<FeedbacksPanel controlId={controlId} feedbacks={config.feedbacks} dragId={'feedback'} />
								</>
							) : (
								''
							)}
						</>
					) : (
						''
					)}

					<hr />

					{parsedId?.page && parsedId?.bank ? (
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
					) : (
						''
					)}
				</div>
			) : (
				''
			)}
		</KeyReceiver>
	)
}

function ActionsSection({ style, controlId, action_sets, runtimeProps }) {
	const context = useContext(StaticContext)

	const confirmRef = useRef()

	const appendStep = useCallback(() => {
		socketEmit2(context.socket, 'controls:action-set:add', [controlId]).catch((e) => {
			console.error('Failed to append set:', e)
		})
	}, [context.socket, controlId])
	const removeStep = useCallback(
		(id) => {
			confirmRef.current.show('Remove step', 'Are you sure you wish to remove this step?', 'Remove', () => {
				socketEmit2(context.socket, 'controls:action-set:remove', [controlId, id]).catch((e) => {
					console.error('Failed to delete set:', e)
				})
			})
		},
		[context.socket, controlId]
	)
	const swapSteps = useCallback(
		(id1, id2) => {
			socketEmit2(context.socket, 'controls:action-set:swap', [controlId, id1, id2]).catch((e) => {
				console.error('Failed to swap sets:', e)
			})
		},
		[context.socket, controlId]
	)
	const setNextStep = useCallback(
		(id) => {
			socketEmit2(context.socket, 'controls:action-set:set-next', [controlId, id]).catch((e) => {
				console.error('Failed to set next set:', e)
			})
		},
		[context.socket, controlId]
	)

	if (style === 'press') {
		return (
			<>
				<h4 className="mt-3">Press actions</h4>
				<ActionsPanel
					controlId={controlId}
					set={'down'}
					dragId={'downAction'}
					addPlaceholder="+ Add key press action"
					actions={action_sets['down']}
				/>
				<h4 className="mt-3">Release actions</h4>
				<ActionsPanel
					controlId={controlId}
					set={'up'}
					dragId={'releaseAction'}
					addPlaceholder="+ Add key release action"
					actions={action_sets['up']}
				/>
			</>
		)
	} else if (style === 'step') {
		const keys = Object.keys(action_sets).sort()
		return (
			<>
				<GenericConfirmModal ref={confirmRef} />
				{keys.map((k, i) => (
					<>
						<h4 key={`heading_${k}`} className="mt-3">
							Step {i + 1} actions
							<CButtonGroup className="right">
								<CButton
									color={runtimeProps.current_step_id === k ? 'success' : 'primary'}
									size="sm"
									disabled={runtimeProps.current_step_id === k}
									onClick={() => setNextStep(k)}
								>
									Set Next
								</CButton>
								<CButton
									color="warning"
									title="Move step up"
									size="sm"
									disabled={i === 0}
									onClick={() => swapSteps(k, keys[i - 1])}
								>
									<FontAwesomeIcon icon={faArrowUp} />
								</CButton>
								<CButton
									color="warning"
									title="Move step down"
									size="sm"
									disabled={i === keys.length - 1}
									onClick={() => swapSteps(k, keys[i + 1])}
								>
									<FontAwesomeIcon icon={faArrowDown} />
								</CButton>
								<CButton
									color="danger"
									title="Delete step"
									size="sm"
									disabled={keys.length === 1}
									onClick={() => removeStep(k)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</CButton>
							</CButtonGroup>
						</h4>
						<ActionsPanel
							key={`panel_${k}`}
							controlId={controlId}
							set={k}
							dragId={`${k}Action`}
							addPlaceholder={`+ Add action to step ${i + 1}`}
							actions={action_sets[k]}
						/>
					</>
				))}
				<br />
				<p>
					<CButton onClick={appendStep} color="primary">
						<FontAwesomeIcon icon={faPlus} /> Add Step
					</CButton>
				</p>
			</>
		)
	} else {
		return ''
	}
}
