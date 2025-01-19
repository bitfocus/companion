import React, { useCallback, useContext, useState } from 'react'
import { SocketContext, PreventDefaultHandler } from '../../util.js'
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
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'

interface RecorderSessionFinishModalProps {
	doClose: () => void
	sessionId: string
}
export function RecorderSessionFinishModal({ doClose, sessionId }: RecorderSessionFinishModalProps) {
	const socket = useContext(SocketContext)

	const doSave = useCallback(
		(controlId: string, stepId: string, setId: ActionSetId, mode: 'replace' | 'append') => {
			socket
				.emitPromise('action-recorder:session:save-to-control', [sessionId, controlId, stepId, setId, mode])
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
