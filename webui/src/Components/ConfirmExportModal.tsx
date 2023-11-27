import { CButton, CLabel, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { ExportFormatDefault, SelectExportFormat } from '../ImportExport/ExportFormat'
import { MenuPortalContext } from './DropdownInputField'
import { windowLinkOpen } from '../Helpers/Window'

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

		const buttonRef = useRef<HTMLElement>(null)

		const buttonFocus = () => {
			if (buttonRef.current) {
				buttonRef.current.focus()
			}
		}

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setData(null), [])
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

		const [modalRef, setModalRef] = useState(null)

		return (
			<CModal innerRef={setModalRef} show={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
				<MenuPortalContext.Provider value={modalRef}>
					<CModalHeader closeButton>
						<h5>{props.title}</h5>
					</CModalHeader>
					<CModalBody>
						<div>
							<div className="indent3">
								<div className="form-check form-check-inline mr-1">
									<CLabel htmlFor="file_format">File format</CLabel>
									&nbsp;
									<SelectExportFormat value={format} setValue={setFormat} />
								</div>
							</div>
						</div>
					</CModalBody>
					<CModalFooter>
						<CButton color="secondary" onClick={doClose}>
							Cancel
						</CButton>
						<CButton innerRef={buttonRef} color="primary" onClick={doAction}>
							Export
						</CButton>
					</CModalFooter>
				</MenuPortalContext.Provider>
			</CModal>
		)
	}
)
