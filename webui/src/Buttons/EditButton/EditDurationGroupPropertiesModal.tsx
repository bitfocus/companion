import { forwardRef, useCallback, useId, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '~/Components/Button'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { Modal } from '~/Components/Modal'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { SURFACE_CUE_TOOLTIP } from './SurfaceCueText.js'

type EditDurationCompleteCallback = (duration: number, whileHeld: boolean, controlEvents: boolean) => void

export interface EditDurationGroupPropertiesModalRef {
	show(
		duration: number,
		whileHeld: boolean,
		controlEvents: boolean,
		completeCallback: EditDurationCompleteCallback
	): void
}

export const EditDurationGroupPropertiesModal = forwardRef<EditDurationGroupPropertiesModalRef>(
	function EditDurationGroupPropertiesModal(_props, ref) {
		const [data, setData] = useState<[number, EditDurationCompleteCallback] | null>(null)
		const [show, setShow] = useState(false)

		const [newDurationValue, setNewDurationValue] = useState<number | null>(null)
		const [newWhileHeldValue, setNewWhileHeldValue] = useState<boolean | null>(null)
		const [newControlEventsValue, setNewControlEventsValue] = useState<boolean | null>(null)

		const buttonRef = useRef<HTMLButtonElement>(null)

		const doAction = useCallback(
			(e: React.FormEvent) => {
				if (e) e.preventDefault()

				setData(null)
				setShow(false)
				setNewDurationValue(null)
				setNewWhileHeldValue(null)
				setNewControlEventsValue(null)

				// completion callback
				const cb = data?.[1]
				if (!cb || newDurationValue === null || newWhileHeldValue === null || newControlEventsValue === null) return
				cb(newDurationValue, newWhileHeldValue, newControlEventsValue)
			},
			[data, newDurationValue, newWhileHeldValue, newControlEventsValue]
		)

		useImperativeHandle(
			ref,
			() => ({
				show(duration, whileHeld, controlEvents, completeCallback) {
					setNewDurationValue(duration)
					setNewWhileHeldValue(whileHeld)
					setNewControlEventsValue(controlEvents)
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
		const controlEventsFieldId = useId()

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
								<Form row className="sm:gap-2" onSubmit={doAction}>
									<FormLabel htmlFor={pressDurationFieldId} sm={4} column="sm">
										Press duration
									</FormLabel>
									<Grid.Col sm={8}>
										<NumberInputField
											id={pressDurationFieldId}
											value={newDurationValue ?? undefined}
											min={1}
											step={1}
											checkValid={newDurationValue !== null && newDurationValue > 0}
											setValue={setNewDurationValue}
											immediateValue
										/>
									</Grid.Col>

									<FormLabel htmlFor={whileHeldFieldId} sm={4} column="sm">
										Execute while held
									</FormLabel>
									<Grid.Col sm={8}>
										<SwitchInputField
											id={whileHeldFieldId}
											value={!!newWhileHeldValue}
											setValue={setNewWhileHeldValue}
										/>
									</Grid.Col>

									<FormLabel htmlFor={controlEventsFieldId} sm={4} column="sm" title={SURFACE_CUE_TOOLTIP}>
										Surface cue
									</FormLabel>
									<Grid.Col sm={8}>
										<CheckboxInputField
											id={controlEventsFieldId}
											value={!!newControlEventsValue}
											setValue={setNewControlEventsValue}
										/>
									</Grid.Col>
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
