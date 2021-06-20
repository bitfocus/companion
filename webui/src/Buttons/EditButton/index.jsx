import { CDropdown, CDropdownToggle, CDropdownItem, CDropdownMenu, CButton, CButtonGroup } from '@coreui/react'
import { faArrowDown, faArrowUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import shortid from 'shortid'
import { BankPreview, dataToButtonImage } from '../../Components/BankButton'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'
import { StaticContext, KeyReceiver, LoadingRetryOrError, socketEmit } from '../../util'
import { ActionsPanel } from './ActionsPanel'

import { ButtonStyleConfig } from './ButtonStyleConfig'
import { FeedbacksPanel } from './FeedbackPanel'

export function EditButton({ page, bank, onKeyUp }) {
	const context = useContext(StaticContext)

	const resetModalRef = useRef()

	const [config, setConfig] = useState(null)
	const configRef = useRef()
	configRef.current = config // update the ref every render

	const [configError, setConfigError] = useState(null)
	const [tableLoadStatus, setTableLoadStatus] = useState({})

	const [reloadConfigToken, setReloadConfigToken] = useState(shortid())
	const [reloadTablesToken, setReloadTablesToken] = useState(shortid())

	const loadConfig = useCallback(() => {
		socketEmit(context.socket, 'get_bank', [page, bank])
			.then(([page, bank, config]) => {
				setConfig(config)
				setConfigError(null)
			})
			.catch((e) => {
				console.error('Failed to load bank config', e)
				setConfig(null)
				setConfigError('Failed to load bank config')
			})
	}, [context.socket, page, bank])

	// Keep config loaded
	useEffect(() => {
		setConfig(null)
		setConfigError(null)

		loadConfig()

		// reload tables too
		setTableLoadStatus({})
		setReloadTablesToken(shortid())
	}, [loadConfig, reloadConfigToken])

	const addLoadStatus = useCallback((key, value) => {
		setTableLoadStatus((oldStatus) => ({ ...oldStatus, [key]: value }))
	}, [])

	const setButtonType = useCallback(
		(newStyle) => {
			let show_warning = false

			const currentStyle = configRef.current?.style
			if (currentStyle === newStyle) {
				// No point changing style to itself
				return
			}

			if (currentStyle && currentStyle !== 'pageup' && currentStyle !== 'pagedown' && currentStyle !== 'pagenum') {
				if (newStyle === 'pageup' || newStyle === 'pagedown' || newStyle === 'pagenum') {
					show_warning = true
				}
			}

			const doChange = () => {
				socketEmit(context.socket, 'bank_style', [page, bank, newStyle])
					.then(([p, b, config]) => {
						setConfig(config)
						setTableLoadStatus({})
						setReloadTablesToken(shortid())
					})
					.catch((e) => {
						console.error('Failed to set bank style', e)
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
		[context.socket, page, bank, configRef]
	)

	const doRetryLoad = useCallback(() => setReloadConfigToken(shortid()), [])
	const resetBank = useCallback(() => {
		resetModalRef.current.show(
			`Clear button ${page}.${bank}`,
			`This will clear the style, feedbacks and all actions`,
			'Clear',
			() => {
				context.socket.emit('bank_reset', page, bank)
				setReloadConfigToken(shortid())
			}
		)
	}, [context.socket, page, bank])

	const errors = Object.values(tableLoadStatus).filter((s) => typeof s === 'string')
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const dataReady = !loadError && !!config && Object.values(tableLoadStatus).filter((s) => s !== true).length === 0

	return (
		<KeyReceiver onKeyUp={onKeyUp} tabIndex={0} className="edit-button-panel">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} />
			{config ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
					<div>
						<ButtonEditPreview page={page} bank={bank} />
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
						<CButton color="danger" hidden={!config.style} onClick={resetBank}>
							Erase
						</CButton>
						&nbsp;
						<CButton
							color="warning"
							hidden={config.style !== 'press' && config.style !== 'step'}
							onMouseDown={() => context.socket.emit('hot_press', page, bank, true)}
							onMouseUp={() => context.socket.emit('hot_press', page, bank, false)}
						>
							Test actions
						</CButton>
					</div>

					<ButtonStyleConfig config={config} configRef={configRef} page={page} bank={bank} valueChanged={loadConfig} />

					<ActionsSection
						style={config.style}
						page={page}
						bank={bank}
						addLoadStatus={addLoadStatus}
						reloadTablesToken={reloadTablesToken}
					/>

					{config.style === 'press' || config.style === 'step' ? (
						<>
							<h4 className="mt-3">Feedback</h4>
							<FeedbacksPanel
								page={page}
								bank={bank}
								dragId={'feedback'}
								addCommand="bank_addFeedback"
								getCommand="bank_get_feedbacks"
								updateOption="bank_update_feedback_option"
								orderCommand="bank_update_feedback_order"
								deleteCommand="bank_delFeedback"
								loadStatusKey={'downActions'}
								setLoadStatus={addLoadStatus}
								reloadToken={reloadTablesToken}
							/>
						</>
					) : (
						''
					)}

					<hr />

					<p>
						<b>Hint:</b> Control buttons with OSC or HTTP: /press/bank/{page}/{bank} to press this button remotely. OSC
						port 12321!
					</p>
				</div>
			) : (
				''
			)}
		</KeyReceiver>
	)
}

function ActionsSection({ style, page, bank, addLoadStatus, reloadTablesToken }) {
	const context = useContext(StaticContext)

	const confirmRef = useRef()
	const [setIds, setSetIds] = useState([])
	const [nextStepId, setNextStepId] = useState('0')

	const [reloadToken2, setReloadToken2] = useState(null)
	useEffect(() => {
		// update when upstream changes
		setReloadToken2(reloadTablesToken)
	}, [reloadTablesToken])

	useEffect(() => {
		setSetIds([])

		socketEmit(context.socket, 'bank_action_sets_list', [page, bank])
			.then(([newIds]) => {
				setSetIds(newIds)
			})
			.catch((e) => {
				console.error('Failed to load set list:', e)
			})
		socketEmit(context.socket, 'bank_action_sets_step', [page, bank])
			.then(([nextStep]) => {
				setNextStepId(nextStep)
			})
			.catch((e) => {
				console.error('Failed to load next step:', e)
			})

		const updateSetsList = (page2, bank2, ids) => {
			if (page2 === page && bank2 === bank) {
				setSetIds(ids)
			}
		}
		const updateNextStep = (page2, bank2, id) => {
			if (page2 === page && bank2 === bank) {
				setNextStepId(id)
			}
		}

		const forceReload = () => setReloadToken2(shortid())

		// listen for updates
		context.socket.on('bank_action_sets_list', updateSetsList)
		context.socket.on('bank_action_sets_reload', forceReload)
		context.socket.on('bank_action_sets_step', updateNextStep)

		return () => {
			context.socket.off('bank_action_sets_list', updateSetsList)
			context.socket.off('bank_action_sets_reload', forceReload)
			context.socket.off('bank_action_sets_step', updateNextStep)
		}
	}, [context.socket, page, bank])

	const appendStep = useCallback(() => {
		socketEmit(context.socket, 'bank_action_sets_append', [page, bank]).catch((e) => {
			console.error('Failed to append set:', e)
		})
	}, [context.socket, page, bank])
	const removeStep = useCallback(
		(id) => {
			confirmRef.current.show('Remove step', 'Are you sure you wish to remove this step?', 'Remove', () => {
				socketEmit(context.socket, 'bank_action_sets_remove', [page, bank, id]).catch((e) => {
					console.error('Failed to delete set:', e)
				})
			})
		},
		[context.socket, page, bank]
	)
	const swapSteps = useCallback(
		(id1, id2) => {
			socketEmit(context.socket, 'bank_action_sets_swap', [page, bank, id1, id2]).catch((e) => {
				console.error('Failed to swap sets:', e)
			})
		},
		[context.socket, page, bank]
	)
	const setNextStep = useCallback(
		(id) => {
			socketEmit(context.socket, 'bank_action_sets_step_set', [page, bank, id]).catch((e) => {
				console.error('Failed to set next set:', e)
			})
		},
		[context.socket, page, bank]
	)

	if (style === 'press') {
		return (
			<>
				<h4 className="mt-3">Press actions</h4>
				<ActionsPanel
					page={page}
					bank={bank}
					set={'down'}
					dragId={'downAction'}
					addPlaceholder="+ Add key press action"
					setLoadStatus={addLoadStatus}
					reloadToken={reloadToken2}
				/>
				<h4 className="mt-3">Release actions</h4>
				<ActionsPanel
					page={page}
					bank={bank}
					set={'up'}
					dragId={'releaseAction'}
					addPlaceholder="+ Add key release action"
					setLoadStatus={addLoadStatus}
					reloadToken={reloadToken2}
				/>
			</>
		)
	} else if (style === 'step') {
		const keys = [...setIds].sort()
		return (
			<>
				<GenericConfirmModal ref={confirmRef} />
				{keys.map((k, i) => (
					<>
						<h4 key={`heading_${k}`} className="mt-3">
							Step {i + 1} actions
							<CButtonGroup className="right">
								<CButton
									color={nextStepId === k ? 'success' : 'primary'}
									size="sm"
									disabled={nextStepId === k}
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
							page={page}
							bank={bank}
							set={k}
							dragId={`${k}Action`}
							addPlaceholder={`+ Add action to step ${i + 1}`}
							setLoadStatus={addLoadStatus}
							reloadToken={reloadToken2}
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

function ButtonEditPreview({ page, bank }) {
	const context = useContext(StaticContext)
	const [previewImage, setPreviewImage] = useState(null)

	// On unmount
	useEffect(() => {
		return () => {
			context.socket.emit('bank_preview', false)
		}
	}, [context.socket])

	// on bank change
	useEffect(() => {
		context.socket.emit('bank_preview', page, bank)

		const cb = (p, b, img) => {
			// eslint-disable-next-line eqeqeq
			if (p == page && b == bank) {
				setPreviewImage(dataToButtonImage(img))
			}
		}
		context.socket.on('preview_bank_data', cb)

		return () => {
			context.socket.off('preview_bank_data', cb)
		}
	}, [context.socket, page, bank])

	return <BankPreview fixedSize preview={previewImage} right={true} />
}
