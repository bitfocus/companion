import { CRow, CCol, CLabel, CForm } from '@coreui/react'
import React, { useCallback, useContext } from 'react'
import { socketEmitPromise, SocketContext } from '../util'
import { CheckboxInputField } from '../Components'

export function ControlOptionsEditor({ controlId, controlType, options, configRef }) {
	const socket = useContext(SocketContext)

	const setValueInner = useCallback(
		(key, value) => {
			console.log('set', controlId, key, value)
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
		<CCol sm={12} className="p-0 mt-5">
			<CForm inline>
				<CRow form className="button-style-form">
					<CCol className="fieldtype-checkbox" sm={2} xs={3}>
						<CLabel>Relative Delays</CLabel>
						<p>
							<CheckboxInputField setValue={setRelativeDelayValue} value={options.relativeDelay} />
						</p>
					</CCol>

					{controlType === 'step' ? (
						<CCol className="fieldtype-checkbox" sm={2} xs={3}>
							<label>Auto progress</label>
							<p>
								<CheckboxInputField setValue={setStepAutoProgressValue} value={options.stepAutoProgress} />
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
