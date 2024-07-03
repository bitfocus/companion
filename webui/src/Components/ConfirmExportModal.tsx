import { CButton, CCol, CForm, CFormLabel, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { ExportFormatDefault, SelectExportFormat } from '../ImportExport/ExportFormat.js'
import { MenuPortalContext } from './DropdownInputField.js'
import { windowLinkOpen } from '../Helpers/Window.js'

export interface ConfirmExportModalRef {
	show(url: string): void
}

interface ConfirmExportModalProps {
	title?: string
}

export const ConfirmExportModal = forwardRef<ConfirmExportModalRef, ConfirmExportModalProps>(
	function ConfirmExportModal(props, ref) {
		const [data, setData] = useState<string | null>(null)
		const [show, setShow] = useState(false)
		const [format, setFormat] = useState(ExportFormatDefault)

		const buttonRef = useRef<HTMLButtonElement>(null)

		const buttonFocus = () => {
			setTimeout(() => {
				if (buttonRef.current) {
					buttonRef.current.focus()
				}
			}, 500)
		}

		const doClose = useCallback(() => {
			setShow(false)

			// Delay clearing the data so the modal can animate out
			setTimeout(() => {
				setData(null)
			}, 1500)
		}, [])
		const doAction = useCallback(() => {
			setData(null)
			setShow(false)

			if (data) {
				const url = new URL(data, window.location.origin)
				url.searchParams.set('format', format)

				windowLinkOpen({ href: url.toString() })
			}
		}, [data, format])

		useImperativeHandle(
			ref,
			() => ({
				show(url) {
					setData(url)
					setShow(true)

					// Focus the button asap. It also gets focused once the open is complete
					setTimeout(buttonFocus, 50)
				},
			}),
			[]
		)

		const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null)

		return (
			<CModal ref={setModalRef} visible={show} onClose={doClose} onShow={buttonFocus}>
				<MenuPortalContext.Provider value={modalRef}>
					<CModalHeader closeButton>
						<h5>{props.title}</h5>
					</CModalHeader>
					<CModalBody>
						<CForm className="row g-3" onSubmit={doAction}>
							<CFormLabel htmlFor="colFormLabelSm" className="col-sm-3 col-form-label col-form-label-sm">
								File format
							</CFormLabel>
							<CCol sm={9}>
								<SelectExportFormat value={format} setValue={setFormat} />
							</CCol>
						</CForm>
					</CModalBody>
					<CModalFooter>
						<CButton color="secondary" onClick={doClose}>
							Cancel
						</CButton>
						<CButton ref={buttonRef} color="primary" onClick={doAction}>
							Export
						</CButton>
					</CModalFooter>
				</MenuPortalContext.Provider>
			</CModal>
		)
	}
)
