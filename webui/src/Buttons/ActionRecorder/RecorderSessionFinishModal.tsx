import React, { useCallback, useState } from 'react'
import { PreventDefaultHandler } from '~/Resources/util.js'
import {
	CButton,
	CCol,
	CRow,
	CForm,
	CModal,
	CModalHeader,
	CModalBody,
	CModalFooter,
	CNav,
	CNavItem,
	CNavLink,
	CTabContent,
	CTabPane,
} from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarAlt, faClock } from '@fortawesome/free-solid-svg-icons'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { ButtonPicker } from './ButtonPicker.js'
import { TriggerPicker } from './TriggerPicker.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

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
						<CNav variant="tabs">
							<CNavItem>
								<CNavLink active={activeTab === 'buttons'} onClick={() => setActiveTab('buttons')}>
									<FontAwesomeIcon icon={faCalendarAlt} /> Buttons
								</CNavLink>
							</CNavItem>
							<CNavItem>
								<CNavLink active={activeTab === 'triggers'} onClick={() => setActiveTab('triggers')}>
									<FontAwesomeIcon icon={faClock} /> Triggers
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent className="default-scroll">
							<CTabPane className="action-recorder-finish-button-grid" visible={activeTab === 'buttons'}>
								<ButtonPicker selectButton={doSave} />
							</CTabPane>
							<CTabPane visible={activeTab === 'triggers'}>
								<CRow>
									<CCol sm={12}>
										<TriggerPicker selectControl={doSave} />
									</CCol>
								</CRow>
							</CTabPane>
						</CTabContent>
					</CModalBody>
					<CModalFooter>
						<CButton color="secondary" onClick={doClose}>
							Cancel
						</CButton>
					</CModalFooter>
				</CForm>
			</MenuPortalContext.Provider>
		</CModal>
	)
}
