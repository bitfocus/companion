import { CButton, CRow, CCol, CButtonGroup, CLabel, CForm, CAlert } from '@coreui/react'
import React, { useCallback, useContext, useState } from 'react'
import { StaticContext, socketEmit, socketEmit2 } from '../../util'
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
import { faTrash } from '@fortawesome/free-solid-svg-icons'

export function ButtonStyleConfig({ page, bank, controlType, config, configRef }) {
	const context = useContext(StaticContext)

	const [pngError, setPngError] = useState(null)
	const setPng = useCallback(
		(data) => {
			setPngError(null)
			socketEmit(context.socket, 'controls:set-config-fields', [
				page,
				bank,
				{
					png64: data,
				},
			]).catch((e) => {
				console.error('Failed to upload png', e)
				setPngError('Failed to set png')
			})
		},
		[context.socket, page, bank]
	)

	const setValueInner = useCallback(
		(key, value) => {
			console.log('set', page, bank, key, value)
			if (configRef.current === undefined || value !== configRef.current[key]) {
				socketEmit2(context.socket, 'controls:set-config-fields', [
					page,
					bank,
					{
						[key]: value,
					},
				]).catch((e) => {
					console.error(`Set field failed: ${e}`)
				})
			}
		},
		[context.socket, page, bank, configRef]
	)
	const clearPng = useCallback(() => setValueInner('png64', null), [setValueInner])

	const setShowTopBar = useCallback((val) => setValueInner('show_topbar', val), [setValueInner])
	const setStepAutoProgressValue = useCallback((val) => setValueInner('step_auto_progress', val), [setValueInner])
	const setRelativeDelayValue = useCallback((val) => setValueInner('relative_delay', val), [setValueInner])

	switch (controlType) {
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
						<CLabel>Relative Delays</CLabel>
						<p>
							<CheckboxInputField
								definition={{ default: false }}
								setValue={setRelativeDelayValue}
								value={config.relative_delay}
							/>
						</p>
					</CCol>

					{controlType === 'step' ? (
						<CCol className="fieldtype-checkbox" sm={2} xs={3}>
							<label>Auto progress</label>
							<p>
								<CheckboxInputField
									definition={{ default: true, id: 'step_auto_progress' }}
									setValue={setStepAutoProgressValue}
									value={config.step_auto_progress}
								/>
							</p>
						</CCol>
					) : (
						''
					)}
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
