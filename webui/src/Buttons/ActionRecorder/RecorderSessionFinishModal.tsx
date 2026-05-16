import { CCol, CForm, CModal, CModalBody, CModalFooter, CModalHeader, CRow } from '@coreui/react'
import { faCalendarAlt, faClock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useState } from 'react'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { Button } from '~/Components/Button'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
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

	const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null)

	const [activeTab, setActiveTab] = useState<'buttons' | 'triggers'>('buttons')

	return (
		<CModal ref={setModalRef} visible={true} onClose={doClose} size="lg" className="modal-full-height" scrollable>
			<MenuPortalContext.Provider value={modalRef}>
				<CForm onSubmit={PreventDefaultHandler} className={'action-recorder-finish-panel'}>
					<CModalHeader closeButton>
						<h5>Select destination</h5>
					</CModalHeader>
					<CModalBody>
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
					</CModalBody>
					<CModalFooter>
						<Button color="secondary" onClick={doClose}>
							Cancel
						</Button>
					</CModalFooter>
				</CForm>
			</MenuPortalContext.Provider>
		</CModal>
	)
}
