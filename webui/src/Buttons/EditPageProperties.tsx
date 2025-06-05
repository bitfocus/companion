import {
	CButton,
	CCol,
	CForm,
	CFormInput,
	CFormLabel,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CRow,
} from '@coreui/react'
import React, { FormEvent, forwardRef, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react'
import { SocketContext } from '~/util.js'
import { PagesStoreModel } from '~/Stores/PagesStore.js'
import { CModalExt } from '~/Components/CModalExt.js'

export interface EditPagePropertiesModalRef {
	show(pageNumber: number, pageInfo: PagesStoreModel | undefined): void
}
interface EditPagePropertiesModalProps {
	includeName: boolean
}

export const EditPagePropertiesModal = forwardRef<EditPagePropertiesModalRef, EditPagePropertiesModalProps>(
	function EditPagePropertiesModal({ includeName }, ref) {
		const socket = useContext(SocketContext)
		const [pageNumber, setPageNumber] = useState<number | null>(null)
		const [show, setShow] = useState(false)

		const [pageName, setName] = useState<string | null>(null)

		const inputRef = useRef<HTMLInputElement>(null)

		const inputFocus = () => {
			if (inputRef.current) {
				inputRef.current.focus()
			}
		}

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setPageNumber(null), [])
		const doAction = useCallback(
			(e: FormEvent) => {
				if (e) e.preventDefault()

				setShow(false)

				if (pageNumber === null) return

				socket.emitPromise('pages:set-name', [pageNumber, pageName ?? '']).catch((e) => {
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

					// Focus the text area
					setTimeout(inputFocus, 50)
				},
			}),
			[]
		)

		const onNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
			setName(e.target.value)
		}, [])

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onOpened={inputFocus}>
				<CModalHeader closeButton>
					<h5>Configure Page {pageNumber}</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={doAction}>
						{includeName && (
							<CRow className="mb-3">
								<CFormLabel htmlFor="colFormName" className="col-sm-3 col-form-label col-form-label-sm">
									Name
								</CFormLabel>
								<CCol sm={9}>
									<CFormInput
										ref={inputRef}
										name="colFormName"
										type="text"
										value={pageName || ''}
										onChange={onNameChange}
									/>
								</CCol>
							</CRow>
						)}
						{/* TODO: more fields should be added here */}
					</CForm>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton color="primary" onClick={doAction}>
						Save
					</CButton>
				</CModalFooter>
			</CModalExt>
		)
	}
)
