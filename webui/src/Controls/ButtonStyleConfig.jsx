import { CButton, CRow, CCol, CButtonGroup, CForm, CAlert, CInputGroup, CInputGroupAppend } from '@coreui/react'
import React, { useCallback, useContext, useMemo, useState } from 'react'
import { socketEmitPromise, SocketContext, UserConfigContext, PreventDefaultHandler } from '../util'
import { AlignmentInputField, ColorInputField, DropdownInputField, PNGInputField, TextInputField } from '../Components'
import { FONT_SIZES } from '../Constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faFont, faQuestionCircle, faTrash } from '@fortawesome/free-solid-svg-icons'

export function ButtonStyleConfig({ controlId, controlType, style, configRef, mainDialog = false }) {
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

	switch (controlType) {
		case undefined:
			return (
				<>
					<h4>Empty button</h4>
					<p className="mt-3">
						To get started, click button above to create a regular button, or use the drop down to make a special
						button.
					</p>
				</>
			)
		case 'pageup':
			return (
				<>
					<h4>Page up button</h4>
					<p className="mt-3">No configuration available for page up buttons</p>
				</>
			)
		case 'pagenum':
			return (
				<>
					<h4>Page number button</h4>
					<p className="mt-3">No configuration available for page number buttons</p>
				</>
			)
		case 'pagedown':
			return (
				<>
					<h4>Page down button</h4>
					<p className="mt-3">No configuration available for page down buttons</p>
				</>
			)
		default:
		// See below
	}

	return (
		<CCol sm={12} className="p-0 mt-0">
			{pngError && (
				<CAlert color="warning" closeButton>
					{pngError}
				</CAlert>
			)}

			<CForm onSubmit={PreventDefaultHandler}>
				<CRow form className="flex-form flex-form-row" style={{ clear: 'both' }}>
					<ButtonStyleConfigFields
						values={style}
						setValueInner={setValueInner}
						setPng={setPng}
						setPngError={setPngError}
						clearPng={clearPng}
						mainDialog={mainDialog}
					/>
				</CRow>
			</CForm>
		</CCol>
	)
}

export function ButtonStyleConfigFields({
	values,
	setValueInner,
	setPng,
	setPngError,
	clearPng,
	mainDialog,
	showField,
}) {
	const setTextValue = useCallback((val) => setValueInner('text', val), [setValueInner])
	const setSizeValue = useCallback((val) => setValueInner('size', val), [setValueInner])
	const setAlignmentValue = useCallback((val) => setValueInner('alignment', val), [setValueInner])
	const setPngAlignmentValue = useCallback((val) => setValueInner('pngalignment', val), [setValueInner])
	const setColorValue = useCallback((val) => setValueInner('color', val), [setValueInner])
	const setBackgroundColorValue = useCallback((val) => setValueInner('bgcolor', val), [setValueInner])
	const setShowTopBar = useCallback((val) => setValueInner('show_topbar', val), [setValueInner])
	const toggleExpression = useCallback(
		() => setValueInner('textExpression', !values.textExpression),
		[setValueInner, values.textExpression]
	)
	const userconfig = useContext(UserConfigContext)

	let pngWidth = 72
	let pngHeight =
		values.show_topbar === false || (values.show_topbar === 'default' && userconfig.remove_topbar === true) ? 72 : 58

	// this style will be different when you use it in the main dialog compared to in the feedback editor.
	const specialStyleForButtonEditor = useMemo(
		() => (mainDialog ? { width: 'calc(100% - 100px)', marginTop: -35, paddingLeft: 4 } : {}),
		[mainDialog]
	)

	const showField2 = (id) => !showField || showField(id)

	return (
		<>
			{showField2('text') && (
				<div style={specialStyleForButtonEditor}>
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
						<TextInputField
							tooltip={'Button text'}
							setValue={setTextValue}
							value={values.text}
							useVariables
							style={{ fontWeight: 'bold', fontSize: 18 }}
						/>
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
				</div>
			)}

			<div style={{ display: 'block', padding: 4 }}>
				<div className="flex flex-wrap gap-1 flex-form">
					{showField2('size') && (
						<div>
							<div>
								<label>Font size</label>
								<DropdownInputField
									choices={FONT_SIZES}
									setValue={setSizeValue}
									value={values.size}
									allowCustom={true}
									regex={'/^0*(?:[3-9]|[1-9][0-9]|1[0-9]{2}|200)\\s?(?:pt|px)?$/i'}
								/>
							</div>
						</div>
					)}
					<div>
						<div className="flex gap-1">
							{showField2('color') && (
								<div>
									<label>Text</label>
									<ColorInputField setValue={setColorValue} value={values.color} />
								</div>
							)}
							{showField2('bgcolor') && (
								<div>
									<label>BG</label>
									<ColorInputField setValue={setBackgroundColorValue} value={values.bgcolor} />
								</div>
							)}
						</div>
					</div>
					{showField2('show_topbar') && (
						<div>
							<label>Topbar</label>
							<DropdownInputField
								choices={[
									{ id: 'default', label: 'Follow Default' },
									{ id: true, label: 'Show' },
									{ id: false, label: 'Hide' },
								]}
								setValue={setShowTopBar}
								value={values.show_topbar}
							/>
						</div>
					)}

					{showField2('alignment') && (
						<div>
							<div>
								<label>Text</label>
								<div style={{ border: '1px solid #ccc' }}>
									<AlignmentInputField setValue={setAlignmentValue} value={values.alignment} />
								</div>
							</div>
						</div>
					)}
					{showField2('pngalignment') && (
						<div>
							<div>
								<label>PNG</label>
								<div style={{ border: '1px solid #ccc' }}>
									<AlignmentInputField setValue={setPngAlignmentValue} value={values.pngalignment} />
								</div>
							</div>
						</div>
					)}
					{showField2('png64') && (
						<div>
							<label>
								{pngWidth}x{pngHeight} PNG
							</label>
							<CButtonGroup className="png-browse">
								<PNGInputField
									onSelect={setPng}
									onError={setPngError}
									min={{ width: 8, height: 8 }}
									max={{ width: 400, height: 400 }}
								/>
								{clearPng && (
									<CButton color="danger" disabled={!values.png64} onClick={clearPng}>
										<FontAwesomeIcon icon={faTrash} />
									</CButton>
								)}
							</CButtonGroup>
						</div>
					)}
				</div>
			</div>
		</>
	)
}
