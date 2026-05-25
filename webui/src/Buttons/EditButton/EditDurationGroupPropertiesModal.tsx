import { CCol } from '@coreui/react'
import { forwardRef, useCallback, useId, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { SwitchInputField } from '~/Components/SwitchInputField'

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

		const doAction = useCallback(
			(e: React.FormEvent) => {
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
				},
			}),
			[]
		)

		const onOpenChangeComplete = useCallback((open: boolean) => {
			if (!open) setData(null)
		}, [])

		const pressDurationFieldId = useId()
		const whileHeldFieldId = useId()

		return (
			<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup initialFocus={buttonRef}>
							<Modal.Header closeButton>
								<Modal.Title>Change delay group properties</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Form className="row g-sm-2" onSubmit={doAction}>
									<FormLabel htmlFor={pressDurationFieldId} className="col-sm-4 col-form-label col-form-label-sm">
										Press duration
									</FormLabel>
									<CCol sm={8}>
										<NumberInputField
											id={pressDurationFieldId}
											value={newDurationValue ?? undefined}
											min={1}
											step={1}
											checkValid={newDurationValue !== null && newDurationValue > 0}
											setValue={setNewDurationValue}
											immediateValue
										/>
									</CCol>

									<FormLabel htmlFor={whileHeldFieldId} className="col-sm-4 col-form-label col-form-label-sm">
										Execute while held
									</FormLabel>
									<CCol sm={8}>
										<SwitchInputField
											id={whileHeldFieldId}
											value={!!newWhileHeldValue}
											setValue={setNewWhileHeldValue}
										/>
									</CCol>
								</Form>
							</Modal.Body>
							<Modal.Footer>
								<Modal.Close>Cancel</Modal.Close>
								<Button ref={buttonRef} color="primary" onClick={doAction}>
									Save
								</Button>
							</Modal.Footer>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	}
)
