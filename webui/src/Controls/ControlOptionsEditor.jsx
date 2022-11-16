import { CRow, CCol, CLabel, CForm } from '@coreui/react'
import React, { useCallback, useContext, useRef } from 'react'
import { socketEmitPromise, SocketContext } from '../util'
import { CheckboxInputField } from '../Components'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

export function ControlOptionsEditor({ controlId, controlType, options, configRef }) {
	const socket = useContext(SocketContext)

	const confirmRef = useRef(null)

	const setValueInner = useCallback(
		(key, value) => {
			if (configRef.current === undefined || value !== configRef.current.options[key]) {
				socketEmitPromise(socket, 'controls:set-options-field', [controlId, key, value]).catch((e) => {
					console.error(`Set field failed: ${e}`)
				})
			}
		},
		[socket, controlId, configRef]
	)

	const setStepAutoProgressValue = useCallback((val) => setValueInner('stepAutoProgress', val), [setValueInner])
	const setRelativeDelayValue = useCallback((val) => setValueInner('relativeDelay', val), [setValueInner])
	const setRotaryActions = useCallback(
		(val) => {
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

	switch (controlType) {
		case undefined:
			return ''
		case 'pageup':
			return ''
		case 'pagenum':
			return ''
		case 'pagedown':
			return ''
		default:
		// See below
	}

	return (
		<CCol sm={12} className="p-0">
			<GenericConfirmModal ref={confirmRef} />

			<CForm>
				<CRow form className="button-style-form">
					<CCol className="fieldtype-checkbox" sm={3} xs={4}>
						<CLabel>Relative Delays</CLabel>
						<p>
							<CheckboxInputField setValue={setRelativeDelayValue} value={options.relativeDelay} />
						</p>
					</CCol>

					{controlType === 'step' && (
						<CCol className="fieldtype-checkbox" sm={3} xs={4}>
							<label>Auto progress step</label>
							<p>
								<CheckboxInputField setValue={setStepAutoProgressValue} value={options.stepAutoProgress} />
							</p>
						</CCol>
					)}

					<CCol className="fieldtype-checkbox" sm={3} xs={4}>
						<label>
							Enable Rotary Actions &nbsp;
							<FontAwesomeIcon
								icon={faQuestionCircle}
								title="Make this bank compatible with rotation events for the Loupedeck Live product range"
							/>
						</label>
						<p>
							<CheckboxInputField setValue={setRotaryActions} value={options.rotaryActions} />
						</p>
					</CCol>
				</CRow>
			</CForm>
		</CCol>
	)
}
