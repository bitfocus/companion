import { CCol, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import React, { MutableRefObject, useCallback, useContext, useRef } from 'react'
import { PreventDefaultHandler, SocketContext } from '../../../util.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../../../Components/GenericConfirmModal.js'
import { InlineHelp } from '../../../Components/InlineHelp.js'
import { LayeredButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { DropdownChoice } from '@companion-module/base'
import { ControlLocalVariables } from '~/Controls/LocalVariablesStore.js'
import { TextInputField } from '~/Components/TextInputField.js'

interface ControlOptionsEditorProps {
	controlId: string
	options: LayeredButtonOptions
	configRef: MutableRefObject<any> // TODO
}

export function ControlOptionsEditor({ controlId, options, configRef }: ControlOptionsEditorProps): JSX.Element | null {
	const socket = useContext(SocketContext)

	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const setValueInner = useCallback(
		(key: string, value: any) => {
			if (configRef.current === undefined || value !== configRef.current.options[key]) {
				socket.emitPromise('controls:set-options-field', [controlId, key, value]).catch((e) => {
					console.error(`Set field failed: ${e}`)
				})
			}
		},
		[socket, controlId, configRef]
	)

	const setStepProgressionValue = useCallback((val: any) => setValueInner('stepProgression', val), [setValueInner])
	const setStepExpressionValue = useCallback((val: string) => setValueInner('stepExpression', val), [setValueInner])
	const setRotaryActions = useCallback(
		(val: boolean) => {
			if (!val && confirmRef.current && configRef.current && configRef.current.options.rotaryActions === true) {
				confirmRef.current.show(
					'Disable rotary actions',
					'Are you sure? This will clear any rotary actions that have been defined.',
					'OK',
					() => {
						setValueInner('rotaryActions', val)
					}
				)
			} else {
				setValueInner('rotaryActions', val)
			}
		},
		[setValueInner, configRef]
	)
	const setCanModifyStyleInApis = useCallback(
		(val: boolean) => setValueInner('canModifyStyleInApis', val),
		[setValueInner]
	)

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />
			<CForm className="row g-2 grow" onSubmit={PreventDefaultHandler}>
				<CFormLabel>
					<InlineHelp help="When this button has multiple steps, progress to the next step when the button is released">
						Step Progression
					</InlineHelp>
				</CFormLabel>
				<CCol sm={8}>
					<DropdownInputField
						choices={STEP_PROGRESSION_CHOICES}
						setValue={setStepProgressionValue}
						value={options.stepProgression}
					/>
				</CCol>

				<CFormLabel htmlFor="colFormRotary" className="col-sm-4 col-form-label col-form-label-sm">
					<InlineHelp help="Make this button compatible with rotation events">Rotary Actions</InlineHelp>
				</CFormLabel>
				<CCol sm={8}>
					<CFormSwitch
						size="xl"
						color="success"
						checked={options.rotaryActions}
						onChange={() => {
							setRotaryActions(!options.rotaryActions)
						}}
					/>
				</CCol>

				<CFormLabel htmlFor="colFormProgress" className="col-sm-4 col-form-label col-form-label-sm">
					<InlineHelp help="Allow the external APIs and internal actions to modify the style of this button">
						Allow style changes
					</InlineHelp>
				</CFormLabel>
				<CCol sm={8}>
					<CFormSwitch
						size="xl"
						color="success"
						checked={options.canModifyStyleInApis}
						onChange={() => {
							setCanModifyStyleInApis(!options.canModifyStyleInApis)
						}}
					/>
				</CCol>
        
				{options.stepProgression === 'expression' && (
					<div className="flex w-full gap-2rem flex-form">
						<div style={{ width: '100%' }}>
							<TextInputField
								label={'Step Progression Expression'}
								tooltip={'Current step of button'}
								setValue={setStepExpressionValue}
								value={options.stepExpression ?? ''}
								useVariables
								localVariables={ControlLocalVariables}
								isExpression
								style={{ fontWeight: 'bold', fontSize: 18 }}
							/>
						</div>
					</div>
				)}
			</CForm>
		</>
	)
}

const STEP_PROGRESSION_CHOICES: DropdownChoice[] = [
	{ id: 'auto', label: 'Auto' },
	{ id: 'manual', label: 'Manual' },
	{ id: 'expression', label: 'Expression' },
]
