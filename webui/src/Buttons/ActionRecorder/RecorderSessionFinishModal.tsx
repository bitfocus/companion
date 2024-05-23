import React, { useCallback, useContext, useState } from 'react'
import { socketEmitPromise, SocketContext, PreventDefaultHandler } from '../../util.js'
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
import { MenuPortalContext } from '../../Components/DropdownInputField.js'
import { ButtonPicker } from './ButtonPicker.js'
import { TriggerPicker } from './TriggerPicker.js'

interface RecorderSessionFinishModalProps {
	doClose: () => void
	sessionId: string
}
export function RecorderSessionFinishModal({ doClose, sessionId }: RecorderSessionFinishModalProps) {
	const socket = useContext(SocketContext)

	const doSave = useCallback(
		(controlId: string, stepId: string, setId: string, mode: 'replace' | 'append') => {
			socketEmitPromise(socket, 'action-recorder:session:save-to-control', [sessionId, controlId, stepId, setId, mode])
				.then(() => {
					doClose()
				})
				.catch((e) => {
					console.error(e)
				})
		},
		[socket, sessionId, doClose]
	)

	const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null)

	return (
		<CModal ref={setModalRef} visible={true} onClose={doClose} size="lg" className="modal-full-height" scrollable>
			<MenuPortalContext.Provider value={modalRef}>
				<CForm onSubmit={PreventDefaultHandler} className={'action-recorder-finish-panel'}>
					<CModalHeader closeButton>
						<h5>Select destination</h5>
					</CModalHeader>
					<CModalBody>
						{/* <CTabs activeTab="buttons"> */}
						<CNav variant="tabs">
							<CNavItem>
								<CNavLink data-tab="buttons">
									<FontAwesomeIcon icon={faCalendarAlt} /> Buttons
								</CNavLink>
							</CNavItem>
							<CNavItem>
								<CNavLink data-tab="triggers">
									<FontAwesomeIcon icon={faClock} /> Triggers
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent className="default-scroll">
							<CTabPane data-tab="buttons" className="action-recorder-finish-button-grid">
								<ButtonPicker selectButton={doSave} />
							</CTabPane>
							<CTabPane data-tab="triggers">
								<CRow>
									<CCol sm={12}>
										<TriggerPicker selectControl={doSave} />
									</CCol>
								</CRow>
							</CTabPane>
						</CTabContent>
						{/* </CTabs> */}
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
