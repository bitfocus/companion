import { CDropdown, CDropdownToggle, CDropdownItem, CDropdownMenu, CButton, CRow } from '@coreui/react'
import React from 'react'
import { CompanionContext, socketEmit } from '../util'
import { ActionsPanel } from './ActionsPanel'

import { ButtonStyleConfig } from './ButtonStyleConfig'

export class EditButton extends React.Component {

	static contextType = CompanionContext

	state = {
		config: null,
	}

	actionsRef = React.createRef()

	componentDidMount() {
		this.reloadConfig()

		this.reloadBankData()
		// socket.emit('bank_actions_get', page, $(this).data('bank'));
		// socket.emit('bank_get_feedbacks', page, $(this).data('bank'));
		// socket.emit('bank_release_actions_get', page, $(this).data('bank'));
		// socket.once('get_bank:results', populate_bank_form);
	}

	reloadBankData = () => {
		// socketEmit(this.context.socket, 'bank_actions_get', [this.props.page, this.props.bank]).then(([page, bank, actions]) => {
		// 	this.setState({
		// 		actions: actions || [],
		// 	})
		// }).catch(e => {
		// 	console.error('Failed to load bank actions', e)
		// })
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
			<div>
				<h3>Configuration</h3>

				<div>
					<CDropdown className="mt-2">
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

					<CButton color='danger' hidden={!config.style} onClick={this.resetBank}>Erase</CButton>
					<CButton
						color='warning'
						hidden={config.style !== 'png'}
						onMouseDown={() => this.context.socket.emit('hot_press', this.props.page, this.props.bank, true)}
						onMouseUp={() => this.context.socket.emit('hot_press', this.props.page, this.props.bank, false)}
					>
						Test actions
					</CButton>
				</div>

				<CRow>
					<ButtonStyleConfig config={config} page={this.props.page} bank={this.props.bank} valueChanged={this.reloadConfig} />
				</CRow>

				<div>
					<h4>Key down/on actions</h4>
					<ActionsPanel
						ref={this.actionsRef}
						page={this.props.page}
						bank={this.props.bank}
						getCommand="bank_actions_get"
						setCommand="bank_update_action_option"
						deleteCommand="bank_action_delete"
					/>

					<select id='addBankAction' className='form-control'></select>

					<h4>Key up/off actions</h4>
					<ActionsPanel
						ref={this.actionsRef}
						page={this.props.page}
						bank={this.props.bank}
						getCommand="bank_release_actions_get"
						setCommand="bank_release_action_update_option"
						deleteCommand="bank_release_action_delete"
					/>

					<select id='addBankReleaseAction' className='form-control'></select>

					<h4>Instance feedback</h4>
					<div id='bankFeedbacks'>
					</div>
					<select id='addBankFeedback' className='form-control'></select>
				</div>

				<p>
					<b>Hint:</b> Control buttons with OSC or HTTP: /press/bank/{this.props.page}/{this.props.bank} to press this button remotely. OSC port 12321!
				</p>
			</div>
		)
	}
}
