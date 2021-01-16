import { CDropdown, CDropdownToggle, CDropdownItem, CDropdownMenu, CButton, CRow, CCol } from '@coreui/react'
import React, { useContext } from 'react'
import { CompanionContext, socketEmit } from './util'
import { DropdownInputField, TextInputField } from './Components'
import { FONT_SIZES } from './Constants'

export class EditButton extends React.Component {

	static contextType = CompanionContext

	state = {
		config: {},
	}

	componentDidMount() {
		this.reloadConfig()

		// socket.emit('bank_actions_get', page, $(this).data('bank'));
		// socket.emit('bank_get_feedbacks', page, $(this).data('bank'));
		// socket.emit('bank_release_actions_get', page, $(this).data('bank'));
		// socket.once('get_bank:results', populate_bank_form);
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

					<CButton color='danger' hidden={!config.style} onClick={() => null}>Erase</CButton>
					<CButton color='warning' hidden={config.style !== 'png'} onClick={() => null}>Test actions</CButton>
				</div>

				<CRow>
					<ButtonStyleConfig config={config} page={this.props.page} bank={this.props.bank} valueChanged={this.reloadConfig} />
				</CRow>

				<p>
					<b>Hint:</b> Control buttons with OSC or HTTP: /press/bank/{this.props.page}/{this.props.bank} to press this button remotely. OSC port 12321!
				</p>
			</div>
		)
	}
}

function ButtonStyleConfig({ page, bank, config, valueChanged }) {
	const context = useContext(CompanionContext)

	switch(config?.style) {
		case undefined:
			return <CCol sm={12}><p>Select a button style</p></CCol>
		case 'pageup':
			return <CCol sm={12}><p>No configuration available for page up buttons</p></CCol>
		case 'pagenum':
			return <CCol sm={12}><p>No configuration available for page number buttons</p></CCol>
		case 'pagedown':
			return <CCol sm={12}><p>No configuration available for page down buttons</p></CCol>
		default:
			// See below
	}

	function setValue(key, value) {
		console.log('set', page, bank, key, value)
		context.socket.emit('bank_changefield', page, bank, key, value)
		valueChanged()
	}

	return (
		<>
			<CCol className='fieldtype-textinput' sm={6}>
				<label>Text</label>
				<TextInputField definition={{ default: '', tooltip: 'Button text' }} setValue={(v) => setValue('text', v)} value={config?.text} valid={true} />
			</CCol>

			<CCol className='fieldtype-dropdown' sm={3}>
				<label>Font size</label>
				<DropdownInputField definition={{ default: 'auto', choices: FONT_SIZES }} setValue={(v) => setValue('size', v)} value={config?.size} />
			</CCol>

			<CCol sm={3}>
				TODO - file picker
			</CCol>
			
			<p>TODO</p>

		</>
	)
}