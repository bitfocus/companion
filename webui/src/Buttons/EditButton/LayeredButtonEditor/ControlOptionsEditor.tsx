import { CCol, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import React, { MutableRefObject, useCallback, useContext, useRef } from 'react'
import { PreventDefaultHandler, SocketContext } from '../../../util.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../../../Components/GenericConfirmModal.js'
import { InlineHelp } from '../../../Components/InlineHelp.js'
import { LayeredButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'

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

	const setStepAutoProgressValue = useCallback(
		(val: boolean) => setValueInner('stepAutoProgress', val),
		[setValueInner]
	)
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
				<CFormLabel htmlFor="colFormProgress" className="col-sm-4 col-form-label col-form-label-sm">
					<InlineHelp help="When this button has multiple steps, progress to the next step when the button is released">
						Step Progress
					</InlineHelp>
				</CFormLabel>
				<CCol sm={8}>
					<CFormSwitch
						size="xl"
						color="success"
						checked={options.stepAutoProgress}
						onChange={() => {
							setStepAutoProgressValue(!options.stepAutoProgress)
						}}
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
			</CForm>
		</>
	)
}
