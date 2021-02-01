import { CButton, CRow, CCol, CButtonGroup, CLabel, CForm } from '@coreui/react'
import React, { useCallback, useContext } from 'react'
import { CompanionContext, socketEmit } from '../../util'
import { AlignmentInputField, CheckboxInputField, ColorInputField, DropdownInputField, PNGInputField, TextWithVariablesInputField } from '../../Components'
import { FONT_SIZES } from '../../Constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'

export function ButtonStyleConfig({ page, bank, config, valueChanged }) {
	const context = useContext(CompanionContext)

	const clearPng = useCallback(() => context.socket.emit('bank_clear_png', page, bank), [context.socket, page, bank])
	const setPng = useCallback((data) => {
		socketEmit(context.socket, 'bank_set_png', [page, bank, data]).then(([res]) => {
			if (res !== 'ok') {
				alert('An error occured while uploading image');
			} else {
				// bank_preview_page(p);
			}
		}).catch(e => {
			console.error('Failed to upload png', e)
		})
	}, [context.socket, page, bank])


	const setValueInner = useCallback((key, value) => {
		console.log('set', page, bank, key, value)
		if (!config || value !== config[key]) {
			context.socket.emit('bank_changefield', page, bank, key, value)
			valueChanged()
		}
	}, [context.socket, page, bank, valueChanged, config])

	const setTextValue = useCallback((val) => setValueInner('text', val), [setValueInner])
	const setSizeValue = useCallback((val) => setValueInner('size', val), [setValueInner])
	const setAlignmentValue = useCallback((val) => setValueInner('alignment', val), [setValueInner])
	const setPngAlignmentValue = useCallback((val) => setValueInner('pngalignment', val), [setValueInner])
	const setColorValue = useCallback((val) => setValueInner('color', val), [setValueInner])
	const setBackgroundColorValue = useCallback((val) => setValueInner('bgcolor', val), [setValueInner])
	const setLatchValue = useCallback((val) => setValueInner('latch', val), [setValueInner])
	const setRelativeDelayValue = useCallback((val) => setValueInner('relative_delay', val), [setValueInner])


	switch (config.style) {
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


	if (!config) {
		return <CCol sm={12}>Loading...</CCol>
	}

	return (
		<CCol sm={12}>
			<CForm inline>
				<CRow form className="button-style-form">
					<CCol className='fieldtype-textinput' sm={6}>
						<label>Text</label>
						<TextWithVariablesInputField definition={{ default: '', tooltip: 'Button text' }} setValue={setTextValue} value={config.text} />
					</CCol>

					<CCol className='fieldtype-dropdown' sm={3} xs={6}>
						<label>Font size</label>
						<DropdownInputField definition={{ default: 'auto', choices: FONT_SIZES }} setValue={setSizeValue} value={config.size} />
					</CCol>

					<CCol sm={3} xs={6}>
						<label>72x58 PNG</label>
						<CButtonGroup className="png-browse">
							<PNGInputField onSelect={setPng} definition={{ min: { width: 72, height: 58 }, max: { width: 72, height: 58 } }} />
							<CButton color='danger' disabled={!config.png64} onClick={clearPng}>
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
						</CButtonGroup>
					</CCol>

					<CCol className='fieldtype-alignment' sm={2} xs={3}>
						<label>Text Alignment</label>
						<AlignmentInputField definition={{ default: 'center:center' }} setValue={setAlignmentValue} value={config.alignment} />
					</CCol>
					<CCol className='fieldtype-alignment' sm={2} xs={3}>
						<label>PNG Alignment</label>
						<AlignmentInputField definition={{ default: 'center:center' }} setValue={setPngAlignmentValue} value={config.pngalignment} />
					</CCol>

					<CCol className='fieldtype-colorpicker' sm={2} xs={3}>
						<label>Color</label>
						<ColorInputField definition={{ default: 0xffffff }} setValue={setColorValue} value={config.color} />
					</CCol>
					<CCol className='fieldtype-colorpicker' sm={2} xs={3}>
						<label>Background</label>
						<ColorInputField definition={{ default: 0x000000 }} setValue={setBackgroundColorValue} value={config.bgcolor} />
					</CCol>

					<CCol className='fieldtype-checkbox' sm={2} xs={3}>
						<label>Latch/Toggle</label>
						<p>
							<CheckboxInputField definition={{ default: false, id: 'latch' }} setValue={setLatchValue} value={config.latch} />
						</p>
					</CCol>
					<CCol className='fieldtype-checkbox' sm={2} xs={3}>
						<CLabel>Relative Delays</CLabel>
						<p>
							<CheckboxInputField definition={{ default: false }} setValue={setRelativeDelayValue} value={config.relative_delay} />
						</p>
					</CCol>
				</CRow>
			</CForm>
		</CCol>
	)
}