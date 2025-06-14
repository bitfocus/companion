import {
	CModalHeader,
	CModalBody,
	CForm,
	CFormLabel,
	CCol,
	CFormInput,
	CFormSwitch,
	CModalFooter,
	CButton,
} from '@coreui/react'
import React, { forwardRef, useState, useRef, useCallback, FormEvent, useImperativeHandle } from 'react'
import { CModalExt } from '~/Components/CModalExt.js'

type EditDurationCompleteCallback = (duration: number, whileHeld: boolean) => void

export interface EditDurationGroupPropertiesModalRef {
	show(duration: number, whileHeld: boolean, completeCallback: EditDurationCompleteCallback): void
}

export const EditDurationGroupPropertiesModal = forwardRef<EditDurationGroupPropertiesModalRef>(
	function EditDurationGroupPropertiesModal(_props, ref) {
		const [data, setData] = useState<[number, EditDurationCompleteCallback] | null>(null)
		const [show, setShow] = useState(false)

		const [newDurationValue, setNewDurationValue] = useState<number | null>(null)
		const [newWhileHeldValue, setNewWhileHeldValue] = useState<boolean | null>(null)

		const buttonRef = useRef<HTMLButtonElement>(null)

		const buttonFocus = () => {
			buttonRef.current?.focus()
		}

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setData(null), [])
		const doAction = useCallback(
			(e: FormEvent) => {
				if (e) e.preventDefault()

				setData(null)
				setShow(false)
				setNewDurationValue(null)
				setNewWhileHeldValue(null)

				// completion callback
				const cb = data?.[1]
				if (!cb || newDurationValue === null || newWhileHeldValue === null) return
				cb(newDurationValue, newWhileHeldValue)
			},
			[data, newDurationValue, newWhileHeldValue]
		)

		useImperativeHandle(
			ref,
			() => ({
				show(duration, whileHeld, completeCallback) {
					setNewDurationValue(duration)
					setNewWhileHeldValue(whileHeld)
					setData([duration, completeCallback])
					setShow(true)

					// Focus the button asap. It also gets focused once the open is complete
					setTimeout(buttonFocus, 50)
				},
			}),
			[]
		)

		const onDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
			setNewDurationValue(Number(e.target.value))
		}, [])

		const onWhileHeldChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
			setNewWhileHeldValue(!!e.target.checked)
		}, [])

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
				<CModalHeader closeButton>
					<h5>Change delay group properties</h5>
				</CModalHeader>
				<CModalBody>
					<CForm className="row g-3" onSubmit={doAction}>
						<CFormLabel htmlFor="colFormPressDuration" className="col-sm-4 col-form-label col-form-label-sm">
							Press duration
						</CFormLabel>
						<CCol sm={8}>
							<CFormInput
								name="colFormPressDuration"
								type="number"
								value={newDurationValue || ''}
								min={1}
								step={1}
								style={{ color: !newDurationValue || newDurationValue <= 0 ? 'red' : undefined }}
								onChange={onDurationChange}
							/>
						</CCol>

						<CFormLabel htmlFor="colFormExecuteWhileHeld" className="col-sm-4 col-form-label col-form-label-sm">
							Execute while held
						</CFormLabel>
						<CCol sm={8}>
							<CFormSwitch
								name="colFormExecuteWhileHeld"
								size="xl"
								checked={!!newWhileHeldValue}
								onChange={onWhileHeldChange}
							/>
						</CCol>
					</CForm>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton ref={buttonRef} color="primary" onClick={doAction}>
						Save
					</CButton>
				</CModalFooter>
			</CModalExt>
		)
	}
)
