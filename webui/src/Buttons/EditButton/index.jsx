import { CDropdown, CDropdownToggle, CDropdownItem, CDropdownMenu, CButton, CButtonGroup } from '@coreui/react'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import shortid from 'shortid'
import { BankPreview, dataToButtonImage } from '../../Components/BankButton'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'
import { CompanionContext, KeyReceiver, LoadingRetryOrError, socketEmit } from '../../util'
import { ActionsPanel } from './ActionsPanel'

import { ButtonStyleConfig } from './ButtonStyleConfig'
import { FeedbacksPanel } from './FeedbackPanel'

export function EditButton({ page, bank, onKeyUp }) {
	const context = useContext(CompanionContext)

	const resetModalRef = useRef()

	const [config, setConfig] = useState(null)
	const [configError, setConfigError] = useState(null)
	const [tableLoadStatus, setTableLoadStatus] = useState({})

	const [reloadConfigToken, setReloadConfigToken] = useState(shortid())
	const [reloadTablesToken, setReloadTablesToken] = useState(shortid())

	const loadConfig = useCallback(() => {
		socketEmit(context.socket, 'get_bank', [page, bank])
			.then(([page, bank, config, fields]) => {
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

			const currentStyle = config?.style
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
		[context.socket, page, bank, config?.style]
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
								<CButton color="success" onClick={() => setButtonType('png')}>
									Regular button
								</CButton>
								<CDropdownToggle
									caret
									color="success"
									style={{ opacity: 0.8, paddingLeft: 6 }}
									className="dropdown-toggle dropdown-toggle-split"
								>
									<span class="sr-only">Toggle Dropdown</span>
								</CDropdownToggle>
							</CButtonGroup>
							<CDropdownMenu>
								<CDropdownItem>Regular button</CDropdownItem>
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
							hidden={config.style !== 'png'}
							onMouseDown={() => context.socket.emit('hot_press', page, bank, true)}
							onMouseUp={() => context.socket.emit('hot_press', page, bank, false)}
						>
							Test actions
						</CButton>
					</div>

					<ButtonStyleConfig config={config} page={page} bank={bank} valueChanged={loadConfig} />

					{config.style === 'png' ? (
						<>
							<h4 className="mt-3">Press/on actions</h4>
							<ActionsPanel
								page={page}
								bank={bank}
								dragId={'downAction'}
								addCommand="bank_action_add"
								getCommand="bank_actions_get"
								updateOption="bank_update_action_option"
								orderCommand="bank_update_action_option_order"
								setDelay="bank_update_action_delay"
								deleteCommand="bank_action_delete"
								addPlaceholder="+ Add key down/on action"
								loadStatusKey={'downActions'}
								setLoadStatus={addLoadStatus}
								reloadToken={reloadTablesToken}
							/>

							<h4 className="mt-3">Release/off actions</h4>
							<ActionsPanel
								page={page}
								bank={bank}
								dragId={'releaseAction'}
								addCommand="bank_addReleaseAction"
								getCommand="bank_release_actions_get"
								updateOption="bank_release_action_update_option"
								orderCommand="bank_release_action_update_option_order"
								setDelay="bank_update_release_action_delay"
								deleteCommand="bank_release_action_delete"
								addPlaceholder="+ Add key up/off action"
								loadStatusKey={'releaseActions'}
								setLoadStatus={addLoadStatus}
								reloadToken={reloadTablesToken}
							/>

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

function ButtonEditPreview({ page, bank }) {
	const context = useContext(CompanionContext)
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
