import { CDropdown, CDropdownToggle, CDropdownItem, CDropdownMenu, CButton, CRow } from '@coreui/react'
import React, { useContext, useEffect, useState } from 'react'
import { BankPreview, dataToButtonImage } from '../../Components/BankButton'
import { CompanionContext, KeyReceiver, socketEmit } from '../../util'
import { ActionsPanel } from './ActionsPanel'

import { ButtonStyleConfig } from './ButtonStyleConfig'
import { FeedbacksPanel } from './FeedbackPanel'

export class EditButton extends React.Component {

	static contextType = CompanionContext

	state = {
		config: null,
	}

	actionsRef = React.createRef()
	releaseActionsRef = React.createRef()
	feedbacksRef = React.createRef()

	componentDidMount() {
		this.reloadConfig()

	}

	reloadConfig = () => {
		socketEmit(this.context.socket, 'get_bank', [this.props.page, this.props.bank]).then(([page, bank, config, fields]) => {
			this.setState({
				config: config,
			})
		}).catch(e => {
			console.error('Failed to load bank config', e)
		})
	}

	resetBank = () => {
		if (window.confirm('Clear design and all actions?')) {
			this.setState({
				config: {},
			})
			this.context.socket.emit('bank_reset', this.props.page, this.props.bank);
			// bank_preview_page(page);
		}
	}

	setButtonType = (newStyle) => {
		let show_warning = false;

		const currentStyle = this.state.config.style

		console.log("CURRENT STYLE", currentStyle, "NEW STYLE", newStyle);
		if (currentStyle && currentStyle !== 'pageup' && currentStyle !== 'pagedown' && currentStyle !== 'pagenum') {
			if (newStyle === 'pageup' || newStyle === 'pagedown' || newStyle === 'pagenum') {
				show_warning = true;
			}
		}

		if (!show_warning || window.confirm('Changing to this button style will erase eventual actions and feedbacks configured for this button - continue?')) {
			const { page, bank } = this.props
			socketEmit(this.context.socket, 'bank_style', [page, bank, newStyle]).then(([p, b, config]) => {
				this.setState({
					config: config
				})

				// bank_preview_page(page);
				// socket.emit('bank_actions_get', page, bank);
				// socket.emit('bank_get_feedbacks', page, bank);
				// socket.emit('bank_release_actions_get', page, bank);
			}).catch(e => {
				console.error('Failed to set bank style', e)
			})
		}
	}

	render() {
		const { config } = this.state
		if (!config) {
			return <div>Loading...</div>
		}

		return (
			<KeyReceiver onKeyUp={this.props.onKeyUp} tabIndex={0} className="edit-button-panel">

				<div>
					<CDropdown className="mt-2" style={{ display: 'inline-block' }}>
						<CDropdownToggle caret color="info">
							Set button type
						</CDropdownToggle>
						<CDropdownMenu>
							<CDropdownItem onClick={() => this.setButtonType('png')}>Regular button</CDropdownItem>
							<CDropdownItem onClick={() => this.setButtonType('pageup')}>Page up</CDropdownItem>
							<CDropdownItem onClick={() => this.setButtonType('pagenum')}>Page number</CDropdownItem>
							<CDropdownItem onClick={() => this.setButtonType('pagedown')}>Page down</CDropdownItem>
						</CDropdownMenu>
					</CDropdown>
					
					&nbsp;

					<CButton color='danger' hidden={!config.style} onClick={this.resetBank}>Erase</CButton>
					&nbsp;
					<CButton
						color='warning'
						hidden={config.style !== 'png'}
						onMouseDown={() => this.context.socket.emit('hot_press', this.props.page, this.props.bank, true)}
						onMouseUp={() => this.context.socket.emit('hot_press', this.props.page, this.props.bank, false)}
					>
						Test actions
					</CButton>
				</div>

				<h4>Configuration</h4>

				<BankPreview2 page={this.props.page} bank={this.props.bank} />

				<CRow>
					<ButtonStyleConfig config={config} page={this.props.page} bank={this.props.bank} valueChanged={this.reloadConfig} />
				</CRow>

				{
					config.style === 'png'
					? <div>
						<h4>Key down/on actions</h4>
						<ActionsPanel
							ref={this.actionsRef}
							page={this.props.page}
							bank={this.props.bank}
							dragId={'downAction'}
							addCommand="bank_action_add"
							getCommand="bank_actions_get"
							updateOption="bank_update_action_option"
							orderCommand="bank_update_action_option_order"
							setDelay="bank_update_action_delay"
							deleteCommand="bank_action_delete"
							addPlaceholder="+ Add key down/on action"
						/>

						<h4>Key up/off actions</h4>
						<ActionsPanel
							ref={this.releaseActionsRef}
							page={this.props.page}
							bank={this.props.bank}
							dragId={'releaseAction'}
							addCommand="bank_addReleaseAction"
							getCommand="bank_release_actions_get"
							updateOption="bank_release_action_update_option"
							orderCommand="bank_release_action_update_option_order"
							setDelay="bank_update_release_action_delay"
							deleteCommand="bank_release_action_delete"
							addPlaceholder="+ Add key up/off action"
						/>

						<h4>Instance feedback</h4>
						<FeedbacksPanel
							ref={this.feedbacksRef}
							page={this.props.page}
							bank={this.props.bank}
							dragId={'feedback'}
							addCommand="bank_addFeedback"
							getCommand="bank_get_feedbacks"
							updateOption="bank_update_feedback_option"
							orderCommand="bank_update_feedback_order"
							deleteCommand="bank_delFeedback"
						/>
					</div>
					: ''
				}

				<p>
					<b>Hint:</b> Control buttons with OSC or HTTP: /press/bank/{this.props.page}/{this.props.bank} to press this button remotely. OSC port 12321!
				</p>
			</KeyReceiver>
		)
	}
}



function BankPreview2({ page, bank }) {
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

	return (
		<BankPreview fixedSize preview={previewImage} />
	)
}