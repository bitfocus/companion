import { CButton, CCol, CButtonGroup, CForm, CAlert, CInputGroup } from '@coreui/react'
import React, { MutableRefObject, useCallback, useContext, useMemo, useState } from 'react'
import { SocketContext, PreventDefaultHandler } from '../util.js'
import {
	AlignmentInputField,
	ColorInputField,
	DropdownInputField,
	PNGInputField,
	TextInputField,
} from '../Components/index.js'
import { FONT_SIZES, SHOW_HIDE_TOP_BAR } from '../Constants.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faFont, faTrash } from '@fortawesome/free-solid-svg-icons'
import { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import { InputFeatureIcons, InputFeatureIconsProps } from './OptionsInputField.js'
import { InlineHelp } from '../Components/InlineHelp.js'
import { ControlLocalVariables } from '../LocalVariableDefinitions.js'

interface ButtonStyleConfigProps {
	controlId: string
	controlType: string
	style: ButtonStyleProperties | undefined
	configRef: MutableRefObject<SomeButtonModel | undefined>
	mainDialog?: boolean
}

export function ButtonStyleConfig({
	controlId,
	controlType,
	style,
	configRef,
	mainDialog = false,
}: ButtonStyleConfigProps) {
	const socket = useContext(SocketContext)

	const [pngError, setPngError] = useState<string | null>(null)
	const setPng = useCallback(
		(data: string | null) => {
			setPngError(null)
			socket
				.emitPromise('controls:set-style-fields', [
					controlId,
					{
						png64: data,
					},
				])
				.catch((e) => {
					console.error('Failed to upload png', e)
					setPngError('Failed to set png')
				})
		},
		[socket, controlId]
	)

	const setValueInner = useCallback(
		(key: string, value: any) => {
			const currentConfig = configRef.current
			if (
				!currentConfig ||
				(currentConfig.type === 'button' && value !== currentConfig.style[key as keyof ButtonStyleProperties])
			) {
				socket
					.emitPromise('controls:set-style-fields', [
						controlId,
						{
							[key]: value,
						},
					])
					.catch((e) => {
						console.error(`Set field failed: ${e}`)
					})
			}
		},
		[socket, controlId, configRef]
	)
	const clearPng = useCallback(() => setValueInner('png64', null), [setValueInner])

	switch (controlType) {
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
				<CAlert color="warning" dismissible>
					{pngError}
				</CAlert>
			)}

			<CForm className="flex-form flex-form-row" style={{}} onSubmit={PreventDefaultHandler}>
				{style && (
					<ButtonStyleConfigFields
						values={style}
						setValueInner={setValueInner}
						setPng={setPng}
						setPngError={setPngError}
						clearPng={clearPng}
						mainDialog={mainDialog}
					/>
				)}
			</CForm>
		</CCol>
	)
}

interface ButtonStyleConfigFieldsProps {
	values: Partial<ButtonStyleProperties>
	setValueInner: (key: string, value: any) => void
	setPng: (png64: string | null) => void
	setPngError: (error: string | null) => void
	clearPng: () => void
	mainDialog?: boolean
	showField?: (key: string) => boolean
}

export function ButtonStyleConfigFields({
	values,
	setValueInner,
	setPng,
	setPngError,
	clearPng,
	mainDialog,
	showField,
}: ButtonStyleConfigFieldsProps) {
	const setTextValue = useCallback((val: any) => setValueInner('text', val), [setValueInner])
	const setSizeValue = useCallback((val: any) => setValueInner('size', val), [setValueInner])
	const setAlignmentValue = useCallback((val: any) => setValueInner('alignment', val), [setValueInner])
	const setPngAlignmentValue = useCallback((val: any) => setValueInner('pngalignment', val), [setValueInner])
	const setColorValue = useCallback((val: any) => setValueInner('color', val), [setValueInner])
	const setBackgroundColorValue = useCallback((val: any) => setValueInner('bgcolor', val), [setValueInner])
	const setShowTopBar = useCallback((val: any) => setValueInner('show_topbar', val), [setValueInner])
	const toggleExpression = useCallback(
		() => setValueInner('textExpression', !values.textExpression),
		[setValueInner, values.textExpression]
	)

	// this style will be different when you use it in the main dialog compared to in the feedback editor.
	const specialStyleForButtonEditor = useMemo(
		() => (mainDialog ? { width: 'calc(100% - 100px)', paddingLeft: 4 } : {}),
		[mainDialog]
	)

	const showField2 = (id: string) => !showField || showField(id)

	const textInputFeatures: InputFeatureIconsProps = {
		variables: true,
		local: true,
	}

	return (
		<>
			{showField2('text') && (
				<div style={specialStyleForButtonEditor}>
					<label>
						{values.textExpression ? (
							<InlineHelp help="You can read more about expressions in the Getting Started pages">
								Button text expression
								<InputFeatureIcons {...textInputFeatures} />
							</InlineHelp>
						) : (
							<InlineHelp help="The text you see on the button you're working with. You can use variables, but not expressions.">
								Button text string
								<InputFeatureIcons {...textInputFeatures} />
							</InlineHelp>
						)}
					</label>
					<CInputGroup>
						<TextInputField
							tooltip={'Button text'}
							setValue={setTextValue}
							value={values.text ?? ''}
							useVariables
							localVariables={ControlLocalVariables}
							isExpression={values.textExpression}
							style={{ fontWeight: 'bold', fontSize: 18 }}
						/>
						<CButton
							color="info"
							variant="outline"
							onClick={toggleExpression}
							title={values.textExpression ? 'Expression mode ' : 'String mode'}
						>
							<FontAwesomeIcon icon={values.textExpression ? faDollarSign : faFont} />
						</CButton>
					</CInputGroup>
				</div>
			)}

			<div style={{ display: 'block', padding: '0 4px', margin: 0 }}>
				<div className="flex flex-wrap column-gap-1rem flex-form">
					{showField2('size') && (
						<div>
							<div>
								<DropdownInputField
									label={'Font size'}
									choices={FONT_SIZES}
									setValue={setSizeValue}
									value={values.size ?? 'auto'}
									allowCustom={true}
									disableEditingCustom={true}
									regex={'/^0*(?:[3-9]|[1-9][0-9]|1[0-9]{2}|200)\\s?(?:pt|px)?$/i'}
								/>
							</div>
						</div>
					)}
					<div>
						<div className="flex gap-1rem">
							{showField2('color') && (
								<div>
									<ColorInputField
										label={'Text'}
										setValue={setColorValue}
										value={values.color ?? 0}
										returnType="number"
										helpText="Font color"
									/>
								</div>
							)}
							{showField2('bgcolor') && (
								<div>
									<ColorInputField
										label={'BG'}
										setValue={setBackgroundColorValue}
										value={values.bgcolor ?? 0}
										returnType="number"
										helpText="Background color"
									/>
								</div>
							)}
						</div>
					</div>
					{showField2('show_topbar') && (
						<div>
							<DropdownInputField
								label={'Topbar'}
								choices={SHOW_HIDE_TOP_BAR}
								setValue={setShowTopBar}
								value={(values.show_topbar as string) ?? false}
								helpText="By default, you have a top bar with the button name and the page number. With this option, you can manually override the default behavior."
							/>
						</div>
					)}

					{showField2('alignment') && (
						<div>
							<div>
								<label>
									<InlineHelp help="Text alignment">Text</InlineHelp>
								</label>
								<div style={{ border: '1px solid #ccc' }}>
									<AlignmentInputField setValue={setAlignmentValue} value={values.alignment ?? 'center:center'} />
								</div>
							</div>
						</div>
					)}
					{showField2('pngalignment') && (
						<div>
							<div>
								<label>
									<InlineHelp help="PNG background image alignment">PNG</InlineHelp>
								</label>
								<div style={{ border: '1px solid #ccc' }}>
									<AlignmentInputField setValue={setPngAlignmentValue} value={values.pngalignment ?? 'center:center'} />
								</div>
							</div>
						</div>
					)}
					{showField2('png64') && (
						<div>
							<label>
								<InlineHelp help="Recommended minimum size is 72x72">PNG</InlineHelp>
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
