import { CLabel } from '@coreui/react'
import React, { useCallback, useContext, useRef } from 'react'
import { socketEmitPromise, SocketContext } from '../util'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'

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
		<>
			{' '}
			<GenericConfirmModal ref={confirmRef} />
			<div className="flex w-full gap-2 flex-form">
				<div>
					<CLabel>
						Relative Delays &nbsp;{' '}
						<FontAwesomeIcon
							icon={faQuestionCircle}
							title="Delay times will be relative to the previous action, rather than all delays being relative to the button press."
						/>
					</CLabel>
					<p>
						<CSwitch
							color="success"
							checked={options.relativeDelay}
							onChange={() => {
								setRelativeDelayValue(!options.relativeDelay)
							}}
						/>
					</p>
				</div>

				{controlType === 'button' && (
					<>
						<div>
							<label>
								Progress &nbsp;
								<FontAwesomeIcon
									icon={faQuestionCircle}
									title="When this button has multiple steps, progress to the next step when the button is released"
								/>
							</label>
							<p>
								<CSwitch
									color="success"
									checked={options.stepAutoProgress}
									onChange={() => {
										setStepAutoProgressValue(!options.stepAutoProgress)
									}}
								/>
							</p>
						</div>

						<div>
							<label>
								Rotary Actions &nbsp;
								<FontAwesomeIcon icon={faQuestionCircle} title="Make this button compatible with rotation events" />
							</label>
							<p>
								<CSwitch
									color="success"
									checked={options.rotaryActions}
									onChange={() => {
										setRotaryActions(!options.rotaryActions)
									}}
								/>
							</p>
						</div>
					</>
				)}
			</div>
		</>
	)
}
