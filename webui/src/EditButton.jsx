import { CDropdown, CDropdownToggle, CDropdownItem, CDropdownMenu, CButton, CRow, CCol, CButtonGroup, CInputFile, CFormGroup, CLabel, CForm } from '@coreui/react'
import React, { useContext } from 'react'
import { CompanionContext, socketEmit } from './util'
import { AlignmentInputField, CheckboxInputField, ColorInputField, DropdownInputField, PNGInputField, TextInputField, TextWithTextInputField } from './Components'
import { FONT_SIZES } from './Constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'

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

	function setPng(data) {
		socketEmit(context.socket, 'bank_set_png', [page, bank, data]).then(([res]) => {
			if (res !== 'ok') {
				alert('An error occured while uploading image');
			} else {
				// bank_preview_page(p);
			}
		}).catch(e => {
			console.error('Failed to upload png', e)
		})
	}

	function clearPng() {
		context.socket.emit('bank_clear_png', page, bank)
	}

	return (
		<CCol sm={12}>
		<CForm>
			<CRow form>
			<CCol className='fieldtype-textinput' sm={6}>
				<label>Text</label>
				<TextWithTextInputField definition={{ default: '', tooltip: 'Button text' }} setValue={(v) => setValue('text', v)} value={config?.text} />
			</CCol>

			<CCol className='fieldtype-dropdown' sm={3}>
				<label>Font size</label>
				<DropdownInputField definition={{ default: 'auto', choices: FONT_SIZES }} setValue={(v) => setValue('size', v)} value={config?.size} />
			</CCol>

			<CCol sm={3}>
				<label>72x58 PNG</label>
				<CButtonGroup size="sm">
					<PNGInputField onSelect={(data) => setPng(data)} />
					<CButton color='danger' disabled={!config.png64} onClick={clearPng}>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</CButtonGroup>
			</CCol>

			<CCol className='fieldtype-alignment' sm={2}>
				<label>Text Alignment</label>
				<AlignmentInputField definition={{ default: 'center:center' }} setValue={(v) => setValue('alignment', v)} value={config?.alignment} />
			</CCol>
			<CCol className='fieldtype-alignment' sm={2}>
				<label>PNG Alignment</label>
				<AlignmentInputField definition={{ default: 'center:center' }} setValue={(v) => setValue('pngalignment', v)} value={config?.pngalignment} />
			</CCol>

			<CCol className='fieldtype-colorpicker' sm={2}>
				<label>Color</label>
				<ColorInputField definition={{ default: 0xffffff }} setValue={(v) => setValue('color', v)} value={config?.color} />
			</CCol>
			<CCol className='fieldtype-colorpicker' sm={2}>
				<label>Background</label>
				<ColorInputField definition={{ default: 0x000000 }} setValue={(v) => setValue('bgcolor', v)} value={config?.bgcolor} />
			</CCol>
			
			<CCol className='fieldtype-checkbox' sm={2}>
				<label>Latch/Toggle</label>
				<CheckboxInputField definition={{ default: false }} setValue={(v) => setValue('latch', v)} value={config?.latch} />
			</CCol>
			<CCol className='fieldtype-checkbox' sm={2}>
				<CLabel>Relative Delays</CLabel>
				<CheckboxInputField definition={{ default: false }} setValue={(v) => setValue('relative_delay', v)} value={config?.relative_delay} />
			</CCol>
			</CRow>
		</CForm>
		</CCol>
	)
}