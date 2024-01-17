import {
	CAlert,
	CButton,
	CForm,
	CFormGroup,
	CInput,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import React, { FormEvent, forwardRef, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react'
import { socketEmitPromise, SocketContext } from '../util.js'
import type { PageModel } from '@companion/shared/Model/PageModel.js'

export interface EditPagePropertiesModalRef {
	show(pageNumber: number, pageInfo: PageModel | undefined): void
}
interface EditPagePropertiesModalProps {
	// Nothing
}

export const EditPagePropertiesModal = forwardRef<EditPagePropertiesModalRef, EditPagePropertiesModalProps>(
	function EditPagePropertiesModal(_props, ref) {
		const socket = useContext(SocketContext)
		const [pageNumber, setPageNumber] = useState<number | null>(null)
		const [show, setShow] = useState(false)

		const [pageName, setName] = useState<string | null>(null)

		const buttonRef = useRef<HTMLButtonElement>(null)

		const buttonFocus = () => {
			if (buttonRef.current) {
				buttonRef.current.focus()
			}
		}

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setPageNumber(null), [])
		const doAction = useCallback(
			(e: FormEvent) => {
				if (e) e.preventDefault()

				setPageNumber(null)
				setShow(false)
				setName(null)

				if (pageNumber === null) return

				socketEmitPromise(socket, 'pages:set-name', [pageNumber, pageName]).catch((e) => {
					console.error('Failed to set name', e)
				})
			},
			[pageNumber, pageName]
		)

		useImperativeHandle(
			ref,
			() => ({
				show(pageNumber, pageInfo) {
					setName(pageInfo?.name ?? null)
					setPageNumber(pageNumber)
					setShow(true)

					// Focus the button asap. It also gets focused once the open is complete
					setTimeout(buttonFocus, 50)
				},
			}),
			[]
		)

		const onNameChange = useCallback((e) => {
			setName(e.target.value)
		}, [])

		return (
			<CModal show={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
				<CModalHeader closeButton>
					<h5>Configure Page {pageNumber}</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={doAction}>
						<CFormGroup>
							<CLabel>Name</CLabel>
							<CInput type="text" value={pageName || ''} onChange={onNameChange} />
						</CFormGroup>

						<CAlert color="info">You can use resize the grid in the Settings tab</CAlert>
					</CForm>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton innerRef={buttonRef} color="primary" onClick={doAction}>
						Save
					</CButton>
				</CModalFooter>
			</CModal>
		)
	}
)
