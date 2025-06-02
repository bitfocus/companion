import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import {
	CAlert,
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
import { CModalExt } from '~/Components/CModalExt.js'
import { useForm } from '@tanstack/react-form'
import { nanoid } from 'nanoid'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { isEmulatorIdValid } from '@companion-app/shared/Label.js'

export interface AddEmulatorModalRef {
	show(): void
}
interface AddEmulatorModalProps {
	// Nothing
}

export const AddEmulatorModal = forwardRef<AddEmulatorModalRef, AddEmulatorModalProps>(
	function SurfaceEditModal(_props, ref) {
		const { socket, surfaces } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)
		const [saveError, setSaveError] = useState<string | null>(null)

		const form = useForm({
			defaultValues: {
				id: nanoid(),
				name: '',
			},
			onSubmit: async ({ value }) => {
				setSaveError(null)

				try {
					await socket.emitPromise('surfaces:emulator-add', [value.id, value.name])
					setShow(false)
				} catch (err: any) {
					setSaveError(`Failed to add emulator: ${err?.message ?? err?.toString() ?? err}`)
				}
			},
		})

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			form.reset()
			setSaveError(null)
		}, [])

		useImperativeHandle(
			ref,
			() => ({
				show() {
					setShow(true)
					setSaveError(null)
					form.reset()
				},
			}),
			[]
		)

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed}>
				<CModalHeader closeButton>
					<h5>Add Emulator</h5>
				</CModalHeader>
				<CForm
					onSubmit={(e) => {
						e.preventDefault()
						e.stopPropagation()
						form.handleSubmit()
					}}
				>
					<CModalBody>
						<CRow className="g-3">
							{saveError && (
								<CCol className={`fieldtype-textinput`} sm={12}>
									<CAlert color="danger">{saveError}</CAlert>
								</CCol>
							)}

							<form.Field
								name="name"
								children={(field) => (
									<>
										<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
											Name
											<InlineHelp help="Display name for the emulator. This can be changed later">
												<FontAwesomeIcon icon={faQuestionCircle} className="ms-2" />
											</InlineHelp>
										</CFormLabel>
										<CCol className={`fieldtype-textinput`} sm={8}>
											<CFormInput
												type="text"
												style={{ color: field.state.meta.errors.length ? 'red' : undefined }}
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
											/>
										</CCol>
									</>
								)}
							/>

							<form.Field
								name="id"
								validators={{
									onChange: ({ value }) => {
										if (!isEmulatorIdValid(value))
											return 'Id must be alphanumeric and can contain underscores and dashes'
										if (!value) return 'Id cannot be empty'
										for (const group of surfaces.store.values()) {
											if (group.surfaces.find((s) => s.id === `emulator:${value}`)) return 'Id already exists'
										}
										return undefined
									},
								}}
								children={(field) => (
									<>
										<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
											Id
											<InlineHelp help="Id for the emulator, this is used in the url and internally. This cannot be changed once set.">
												<FontAwesomeIcon icon={faQuestionCircle} className="ms-2" />
											</InlineHelp>
										</CFormLabel>
										<CCol className={`fieldtype-textinput`} sm={8}>
											<CFormInput
												type="text"
												style={{ color: field.state.meta.errors.length ? 'red' : undefined }}
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
											/>
											{field.state.meta.errors.length > 0 && (
												<CAlert color="warning" className="mt-2">
													{field.state.meta.errors}
												</CAlert>
											)}
										</CCol>
									</>
								)}
							/>
						</CRow>
					</CModalBody>
					<CModalFooter>
						<form.Subscribe
							selector={(state) => [state.canSubmit, state.isSubmitting]}
							children={([canSubmit, isSubmitting]) => (
								<>
									<CButton color="secondary" onClick={doClose} disabled={isSubmitting}>
										Cancel
									</CButton>

									<CButton
										color="primary"
										className="me-md-1"
										disabled={!canSubmit || isSubmitting}
										type="submit"
										onClick={form.handleSubmit}
									>
										Add {isSubmitting ? '...' : ''}
									</CButton>
								</>
							)}
						/>
					</CModalFooter>
				</CForm>
			</CModalExt>
		)
	}
)
