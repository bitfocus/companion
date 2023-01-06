import { CButton, CRow, CCol, CButtonGroup, CForm, CAlert, CInputGroup, CInputGroupAppend } from '@coreui/react'
import React, { useCallback, useContext, useState } from 'react'
import { socketEmitPromise, SocketContext } from '../util'
import { AlignmentInputField, ColorInputField, DropdownInputField, PNGInputField, TextInputField } from '../Components'
import { FONT_SIZES } from '../Constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faFont, faQuestionCircle, faTrash } from '@fortawesome/free-solid-svg-icons'

export function ButtonStyleConfig({ controlId, controlType, style, configRef }) {
	const socket = useContext(SocketContext)

	const [pngError, setPngError] = useState(null)
	const setPng = useCallback(
		(data) => {
			setPngError(null)
			socketEmitPromise(socket, 'controls:set-style-fields', [
				controlId,
				{
					png64: data,
				},
			]).catch((e) => {
				console.error('Failed to upload png', e)
				setPngError('Failed to set png')
			})
		},
		[socket, controlId]
	)

	const setValueInner = useCallback(
		(key, value) => {
			if (configRef.current === undefined || value !== configRef.current.style[key]) {
				socketEmitPromise(socket, 'controls:set-style-fields', [
					controlId,
					{
						[key]: value,
					},
				]).catch((e) => {
					console.error(`Set field failed: ${e}`)
				})
			}
		},
		[socket, controlId, configRef]
	)
	const clearPng = useCallback(() => setValueInner('png64', null), [setValueInner])

	const setShowTopBar = useCallback((val) => setValueInner('show_topbar', val), [setValueInner])

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
			{pngError && (
				<CAlert color="warning" closeButton>
					{pngError}
				</CAlert>
			)}

			<CForm>
				<CRow form className="button-style-form">
					<ButtonStyleConfigFields
						values={style}
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
								choices={[
									{ id: 'default', label: 'Follow Default' },
									{ id: true, label: 'Show' },
									{ id: false, label: 'Hide' },
								]}
								setValue={setShowTopBar}
								value={style.show_topbar}
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

	const toggleExpression = useCallback(
		() => setValueInner('textExpression', !values.textExpression),
		[setValueInner, values.textExpression]
	)

	return (
		<>
			{controlTemplate(
				'text',
				{ sm: 6 },
				<>
					<label>
						{values.textExpression ? (
							<>
								Button text expression&nbsp;
								<FontAwesomeIcon
									icon={faQuestionCircle}
									title="You can read more about expressions in the Getting Started pages"
								/>
							</>
						) : (
							'Button text string'
						)}
					</label>
					<CInputGroup>
						<TextInputField tooltip={'Button text'} setValue={setTextValue} value={values.text} useVariables />
						<CInputGroupAppend>
							<CButton
								color="info"
								variant="outline"
								onClick={toggleExpression}
								title={values.textExpression ? 'Expression mode ' : 'String mode'}
							>
								<FontAwesomeIcon icon={values.textExpression ? faDollarSign : faFont} />
							</CButton>
						</CInputGroupAppend>
					</CInputGroup>
				</>
			)}

			{controlTemplate(
				'size',
				{ sm: 3, xs: 6 },
				<>
					<label>Font size</label>
					<DropdownInputField choices={FONT_SIZES} setValue={setSizeValue} value={values.size} />
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
							min={{ width: 36, height: 36 }}
							max={{ width: 72, height: 58 }}
						/>
						{clearPng && (
							<CButton color="danger" disabled={!values.png64} onClick={clearPng}>
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
						)}
					</CButtonGroup>
				</>
			)}
			{controlTemplate(
				'alignment',
				{ sm: 2, xs: 3 },
				<>
					<label>Text Alignment</label>
					<AlignmentInputField setValue={setAlignmentValue} value={values.alignment} />
				</>
			)}
			{controlTemplate(
				'pngalignment',
				{ sm: 2, xs: 3 },
				<>
					<label>PNG Alignment</label>
					<AlignmentInputField setValue={setPngAlignmentValue} value={values.pngalignment} />
				</>
			)}

			{controlTemplate(
				'color',
				{ sm: 2, xs: 3 },
				<>
					<label>Color</label>
					<ColorInputField setValue={setColorValue} value={values.color} />
				</>
			)}
			{controlTemplate(
				'bgcolor',
				{ sm: 2, xs: 3 },
				<>
					<label>Background</label>
					<ColorInputField setValue={setBackgroundColorValue} value={values.bgcolor} />
				</>
			)}
		</>
	)
}
