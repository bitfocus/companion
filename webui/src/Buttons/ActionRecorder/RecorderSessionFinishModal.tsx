import { CCol, CRow } from '@coreui/react'
import { faCalendarAlt, faClock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useState } from 'react'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { Form } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal.js'
import { TabArea } from '~/Components/TabArea.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { ButtonPicker } from './ButtonPicker.js'
import { TriggerPicker } from './TriggerPicker.js'

interface RecorderSessionFinishModalProps {
	doClose: () => void
	sessionId: string
}
export function RecorderSessionFinishModal({ doClose, sessionId }: RecorderSessionFinishModalProps): React.JSX.Element {
	const saveToControlMutation = useMutationExt(trpc.actionRecorder.session.saveToControl.mutationOptions())

	const doSave = useCallback(
		(controlId: string, stepId: string, setId: ActionSetId, mode: 'replace' | 'append') => {
			saveToControlMutation
				.mutateAsync({ sessionId, controlId, stepId, setId, mode })
				.then(() => {
					doClose()
				})
				.catch((e) => {
					console.error(e)
				})
		},
		[saveToControlMutation, sessionId, doClose]
	)

	const onOpenChange = useCallback(
		(open: boolean) => {
			if (!open) doClose()
		},
		[doClose]
	)

	const [activeTab, setActiveTab] = useState<'buttons' | 'triggers'>('buttons')

	return (
		<Modal.Root open={true} onOpenChange={onOpenChange}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable className="modal-full-height">
						<Modal.Header closeButton>
							<Modal.Title>Select destination</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<Form onSubmit={PreventDefaultHandler}>
								<TabArea.Root value={activeTab} onValueChange={setActiveTab}>
									<TabArea.List>
										<TabArea.Tab value="buttons">
											<FontAwesomeIcon icon={faCalendarAlt} /> Buttons
										</TabArea.Tab>
										<TabArea.Tab value="triggers">
											<FontAwesomeIcon icon={faClock} /> Triggers
										</TabArea.Tab>
									</TabArea.List>
									<TabArea.Panel className="action-recorder-finish-button-grid" value="buttons">
										<ButtonPicker selectButton={doSave} />
									</TabArea.Panel>
									<TabArea.Panel value="triggers">
										<CRow>
											<CCol sm={12}>
												<TriggerPicker selectControl={doSave} />
											</CCol>
										</CRow>
									</TabArea.Panel>
								</TabArea.Root>
							</Form>
						</Modal.Body>
						<Modal.Footer>
							<Modal.Close>Cancel</Modal.Close>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
