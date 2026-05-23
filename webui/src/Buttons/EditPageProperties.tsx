import { CCol, CFormInput, CRow } from '@coreui/react'
import { forwardRef, useCallback, useId, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import type { PagesStoreModel } from '~/Stores/PagesStore.js'

export interface EditPagePropertiesModalRef {
	show(pageNumber: number, pageInfo: PagesStoreModel | undefined): void
}
interface EditPagePropertiesModalProps {
	includeName: boolean
}

export const EditPagePropertiesModal = forwardRef<EditPagePropertiesModalRef, EditPagePropertiesModalProps>(
	function EditPagePropertiesModal({ includeName }, ref) {
		const [pageNumber, setPageNumber] = useState<number | null>(null)
		const [show, setShow] = useState(false)

		const [pageName, setName] = useState<string | null>(null)

		const inputRef = useRef<HTMLInputElement>(null)

		const setNameMutation = useMutationExt(trpc.pages.setName.mutationOptions())

		const doAction = useCallback(
			(e: React.FormEvent) => {
				e.preventDefault()
				e.stopPropagation()

				setShow(false)

				if (pageNumber === null) return

				setNameMutation
					.mutateAsync({
						pageNumber,
						name: pageName ?? '',
					})
					.catch((e) => {
						console.error('Failed to set name', e)
					})
			},
			[setNameMutation, pageNumber, pageName]
		)

		useImperativeHandle(
			ref,
			() => ({
				show(pageNumber, pageInfo) {
					setName(pageInfo?.name ?? null)
					setPageNumber(pageNumber)
					setShow(true)
				},
			}),
			[]
		)

		const onOpenChangeComplete = useCallback((open: boolean) => {
			if (!open) {
				setPageNumber(null)
				setName(null)
			}
		}, [])

		const onNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
			setName(e.target.value)
		}, [])

		const nameFieldId = useId()

		return (
			<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup initialFocus={inputRef}>
							<Modal.Header closeButton>
								<Modal.Title>Configure Page {pageNumber}</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Form onSubmit={doAction}>
									{includeName && (
										<CRow className="mb-3">
											<FormLabel htmlFor={nameFieldId} className="col-sm-3 col-form-label col-form-label-sm">
												Name
											</FormLabel>
											<CCol sm={9}>
												<CFormInput
													ref={inputRef}
													id={nameFieldId}
													type="text"
													value={pageName || ''}
													onChange={onNameChange}
												/>
											</CCol>
										</CRow>
									)}
									{/* TODO: more fields should be added here */}
								</Form>
							</Modal.Body>
							<Modal.Footer>
								<Modal.Close>Cancel</Modal.Close>
								<Button color="primary" onClick={doAction}>
									Save
								</Button>
							</Modal.Footer>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	}
)
