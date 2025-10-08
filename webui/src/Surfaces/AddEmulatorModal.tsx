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
import { trpc, useMutationExt, RouterInputs } from '~/Resources/TRPC'

type EmulatorAddInput = RouterInputs['surfaces']['emulatorAdd']

export interface AddEmulatorModalRef {
	show(): void
}

export const AddEmulatorModal = forwardRef<AddEmulatorModalRef>(function SurfaceEditModal(_props, ref) {
	const { surfaces } = useContext(RootAppStoreContext)

	const [show, setShow] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)

	const addEmulatorMutation = useMutationExt(trpc.surfaces.emulatorAdd.mutationOptions())

	const form = useForm({
		defaultValues: {
			baseId: nanoid(),
			name: '',
			rows: 4,
			columns: 8,
		} satisfies EmulatorAddInput,
		onSubmit: async ({ value }) => {
			setSaveError(null)

			try {
				await addEmulatorMutation.mutateAsync({
					baseId: value.baseId,
					name: value.name,
					rows: value.rows,
					columns: value.columns,
				})
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
	}, [form])

	useImperativeHandle(
		ref,
		() => ({
			show() {
				setShow(true)
				setSaveError(null)
				form.reset()
			},
		}),
		[form]
	)

	return (
		<CModalExt visible={show} onClose={doClose} onClosed={onClosed} className="modal-add-emulator">
			<CModalHeader closeButton>
				<h5>Add Emulator</h5>
			</CModalHeader>
			<CForm
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit().catch((err) => {
						console.error('Add emulator failed', err)
					})
				}}
			>
				<CModalBody>
					<CRow className="g-sm-2">
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
							name="baseId"
							validators={{
								onChange: ({ value }) => {
									if (!isEmulatorIdValid(value)) return 'Id must be alphanumeric and can contain underscores and dashes'
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

						<form.Field
							name="rows"
							validators={{
								onChange: ({ value }) => {
									const n = Number(value)
									if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
										return 'Rows must be a positive integer'
									}
									return undefined
								},
							}}
							children={(field) => (
								<>
									<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Rows</CFormLabel>
									<CCol className={`fieldtype-textinput`} sm={8}>
										<CFormInput
											type="number"
											min={1}
											style={{ width: '100%', color: field.state.meta.errors.length ? 'red' : undefined }}
											value={field.state.value}
											onChange={(e) => field.handleChange((e.target as HTMLInputElement).valueAsNumber)}
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

						<form.Field
							name="columns"
							validators={{
								onChange: ({ value }) => {
									const n = Number(value)
									if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
										return 'Columns must be a positive integer'
									}
									return undefined
								},
							}}
							children={(field) => (
								<>
									<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Columns</CFormLabel>
									<CCol className={`fieldtype-textinput`} sm={8}>
										<CFormInput
											type="number"
											min={1}
											style={{ width: '100%', color: field.state.meta.errors.length ? 'red' : undefined }}
											value={field.state.value}
											onChange={(e) => field.handleChange((e.target as HTMLInputElement).valueAsNumber)}
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
									onClick={() => {
										form.handleSubmit().catch((err) => {
											console.error('Add emulator failed', err)
										})
									}}
								>
									Add{isSubmitting ? ' ...' : ''}
								</CButton>
							</>
						)}
					/>
				</CModalFooter>
			</CForm>
		</CModalExt>
	)
})
