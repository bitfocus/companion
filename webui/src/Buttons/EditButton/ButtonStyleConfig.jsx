import { CButton, CRow, CCol, CButtonGroup, CLabel, CForm, CAlert } from '@coreui/react'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { StaticContext, socketEmit } from '../../util'
import {
	AlignmentInputField,
	CheckboxInputField,
	ColorInputField,
	DropdownInputField,
	PNGInputField,
	TextWithVariablesInputField,
} from '../../Components'
import { FONT_SIZES } from '../../Constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle, faTrash } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal } from '../../Components/GenericConfirmModal'

export function ButtonStyleConfig({ page, bank, config, configRef, valueChanged }) {
	const context = useContext(StaticContext)

	const confirmRef = useRef(null)

	const [pngError, setPngError] = useState(null)
	const clearPng = useCallback(() => context.socket.emit('bank_clear_png', page, bank), [context.socket, page, bank])
	const setPng = useCallback(
		(data) => {
			setPngError(null)
			socketEmit(context.socket, 'bank_set_png', [page, bank, data])
				.then(([res]) => {
					if (res !== 'ok') {
						setPngError('An error occured while uploading image')
					} else {
						setPngError(null)
						// bank_preview_page(p);
					}
				})
				.catch((e) => {
					console.error('Failed to upload png', e)
					setPngError('Failed to set png')
				})
		},
		[context.socket, page, bank]
	)

	const setValueInner = useCallback(
		(key, value) => {
			if (!configRef.current || value !== configRef.current[key]) {
				context.socket.emit('bank_changefield', page, bank, key, value)
				valueChanged()
			}
		},
		[context.socket, page, bank, valueChanged, configRef]
	)

	const setShowTopBar = useCallback((val) => setValueInner('show_topbar', val), [setValueInner])
	const setLatchValue = useCallback((val) => setValueInner('latch', val), [setValueInner])
	const setRelativeDelayValue = useCallback((val) => setValueInner('relative_delay', val), [setValueInner])
	const setRotaryActions = useCallback(
		(val) => {
			if (!val && confirmRef.current) {
				confirmRef.current.show(
					'Disable rotary actions',
					'Are you sure? This will clear any rotary actions that have been defined.',
					'OK',
					() => {
						setValueInner('rotary_actions', val)
					}
				)
			} else {
				setValueInner('rotary_actions', val)
			}
		},
		[setValueInner]
	)

	switch (config.style) {
		case undefined:
			return (
				<CAlert color="dark" className="mt-5">
					Select a button style to continue
				</CAlert>
			)
		case 'pageup':
			return <p className="mt-3">No configuration available for page up buttons</p>
		case 'pagenum':
			return <p className="mt-3">No configuration available for page number buttons</p>
		case 'pagedown':
			return <p className="mt-3">No configuration available for page down buttons</p>
		default:
		// See below
	}

	return (
		<CCol sm={12} className="p-0 mt-5">
			{pngError ? (
				<CAlert color="warning" closeButton>
					{pngError}
				</CAlert>
			) : (
				''
			)}

			<GenericConfirmModal ref={confirmRef} />

			<CForm inline>
				<CRow form className="button-style-form">
					<ButtonStyleConfigFields
						values={config}
						setValueInner={setValueInner}
						setPng={setPng}
						setPngError={setPngError}
						clearPng={clearPng}
						controlTemplate={ControlWrapper}
					/>

					<CCol className="fieldtype-checkbox" sm={3} xs={6}>
						<label>Show Topbar</label>
						<p>
							<DropdownInputField
								definition={{
									default: 'default',
									id: 'show_topbar',
									choices: [
										{ id: 'default', label: 'Follow Default' },
										{ id: true, label: 'Show' },
										{ id: false, label: 'Hide' },
									],
								}}
								setValue={setShowTopBar}
								value={config.show_topbar}
							/>
						</p>
					</CCol>

					<CCol className="fieldtype-checkbox" sm={2} xs={3}>
						<label>Latch/Toggle</label>
						<p>
							<CheckboxInputField
								definition={{ default: false, id: 'latch' }}
								setValue={setLatchValue}
								value={config.latch}
							/>
						</p>
					</CCol>
					<CCol className="fieldtype-checkbox" sm={2} xs={3}>
						<CLabel>Relative Delays</CLabel>
						<p>
							<CheckboxInputField
								definition={{ default: false }}
								setValue={setRelativeDelayValue}
								value={config.relative_delay}
							/>
						</p>
					</CCol>
					<CCol className="fieldtype-checkbox" sm={2} xs={3}>
						<label>
							Enable Rotary Actions
							<FontAwesomeIcon
								icon={faQuestionCircle}
								title="Make this bank compatible with rotation events for the Loupedeck Live product range"
							/>
						</label>
						<p>
							<CheckboxInputField
								definition={{ default: false, id: 'rotary_actions' }}
								setValue={setRotaryActions}
								value={config.rotary_actions}
							/>
						</p>
					</CCol>
				</CRow>
			</CForm>
		</CCol>
	)
}

function ControlWrapper(id, props, contents) {
	return <CCol {...props}>{contents}</CCol>
}

export function ButtonStyleConfigFields({ values, setValueInner, setPng, setPngError, clearPng, controlTemplate }) {
	const setTextValue = useCallback((val) => setValueInner('text', val), [setValueInner])
	const setSizeValue = useCallback((val) => setValueInner('size', val), [setValueInner])
	const setAlignmentValue = useCallback((val) => setValueInner('alignment', val), [setValueInner])
	const setPngAlignmentValue = useCallback((val) => setValueInner('pngalignment', val), [setValueInner])
	const setColorValue = useCallback((val) => setValueInner('color', val), [setValueInner])
	const setBackgroundColorValue = useCallback((val) => setValueInner('bgcolor', val), [setValueInner])

	return (
		<>
			{controlTemplate(
				'text',
				{ sm: 6 },
				<>
					<label>Button text</label>
					<TextWithVariablesInputField
						definition={{ default: '', tooltip: 'Button text' }}
						setValue={setTextValue}
						value={values.text}
					/>
				</>
			)}

			{controlTemplate(
				'size',
				{ sm: 3, xs: 6 },
				<>
					<label>Font size</label>
					<DropdownInputField
						definition={{ default: 'auto', choices: FONT_SIZES }}
						setValue={setSizeValue}
						value={values.size}
					/>
				</>
			)}

			{controlTemplate(
				'png64',
				{ sm: 3, xs: 6 },
				<>
					<label>72x58 PNG</label>
					<CButtonGroup className="png-browse">
						<PNGInputField
							onSelect={setPng}
							onError={setPngError}
							definition={{ min: { width: 36, height: 36 }, max: { width: 72, height: 58 } }}
						/>
						{clearPng ? (
							<CButton color="danger" disabled={!values.png64} onClick={clearPng}>
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
						) : (
							''
						)}
					</CButtonGroup>
				</>
			)}
			{controlTemplate(
				'alignment',
				{ sm: 2, xs: 3 },
				<>
					<label>Text Alignment</label>
					<AlignmentInputField
						definition={{ default: 'center:center' }}
						setValue={setAlignmentValue}
						value={values.alignment}
					/>
				</>
			)}
			{controlTemplate(
				'pngalignment',
				{ sm: 2, xs: 3 },
				<>
					<label>PNG Alignment</label>
					<AlignmentInputField
						definition={{ default: 'center:center' }}
						setValue={setPngAlignmentValue}
						value={values.pngalignment}
					/>
				</>
			)}

			{controlTemplate(
				'color',
				{ sm: 2, xs: 3 },
				<>
					<label>Color</label>
					<ColorInputField definition={{ default: 0xffffff }} setValue={setColorValue} value={values.color} />
				</>
			)}
			{controlTemplate(
				'bgcolor',
				{ sm: 2, xs: 3 },
				<>
					<label>Background</label>
					<ColorInputField
						definition={{ default: 0x000000 }}
						setValue={setBackgroundColorValue}
						value={values.bgcolor}
					/>
				</>
			)}
		</>
	)
}
