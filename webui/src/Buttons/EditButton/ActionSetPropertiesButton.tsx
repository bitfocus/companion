import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useId, useRef, useState } from 'react'
import { Button } from '~/Components/Button'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { Modal } from '~/Components/Modal'
import { SURFACE_CUE_TOOLTIP } from './SurfaceCueText.js'

interface ActionSetPropertiesButtonProps {
	controlEvents: boolean
	setControlEvents: (enabled: boolean) => void
}

/**
 * Opens the properties of the press or release group, a cut back version of the delay group properties
 */
export function ActionSetPropertiesButton({
	controlEvents,
	setControlEvents,
}: ActionSetPropertiesButtonProps): React.JSX.Element {
	const [show, setShow] = useState(false)
	const [newControlEventsValue, setNewControlEventsValue] = useState(controlEvents)

	const saveButtonRef = useRef<HTMLButtonElement>(null)
	const controlEventsFieldId = useId()

	const open = useCallback(() => {
		setNewControlEventsValue(controlEvents)
		setShow(true)
	}, [controlEvents])

	const doAction = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			setShow(false)

			if (newControlEventsValue !== controlEvents) setControlEvents(newControlEventsValue)
		},
		[controlEvents, newControlEventsValue, setControlEvents]
	)

	return (
		<>
			<Button title="Configure" size="sm" onClick={open}>
				<FontAwesomeIcon icon={faPencil} />
			</Button>

			<Modal.Root open={show} onOpenChange={setShow}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup initialFocus={saveButtonRef}>
							<Modal.Header closeButton>
								<Modal.Title>Change group properties</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Form row className="sm:gap-2" onSubmit={doAction}>
									<FormLabel htmlFor={controlEventsFieldId} sm={4} column="sm" title={SURFACE_CUE_TOOLTIP}>
										Surface cue
									</FormLabel>
									<Grid.Col sm={8}>
										<CheckboxInputField
											id={controlEventsFieldId}
											value={newControlEventsValue}
											setValue={setNewControlEventsValue}
										/>
									</Grid.Col>
								</Form>
							</Modal.Body>
							<Modal.Footer>
								<Modal.Close>Cancel</Modal.Close>
								<Button ref={saveButtonRef} color="primary" onClick={doAction}>
									Save
								</Button>
							</Modal.Footer>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		</>
	)
}
