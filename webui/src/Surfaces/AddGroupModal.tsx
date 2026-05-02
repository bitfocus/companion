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
import { useForm } from '@tanstack/react-form'
import { nanoid } from 'nanoid'
import { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { isSurfaceGroupIdValid } from '@companion-app/shared/Label.js'
import { CModalExt } from '~/Components/CModalExt.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export interface AddSurfaceGroupModalRef {
	show(): void
}

export const AddSurfaceGroupModal = forwardRef<AddSurfaceGroupModalRef>(function SurfaceEditModal(_props, ref) {
	const { surfaces } = useContext(RootAppStoreContext)

	const [show, setShow] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)

	const addGroupMutation = useMutationExt(trpc.surfaces.groupAdd.mutationOptions())
	const form = useForm({
		defaultValues: {
			id: nanoid(),
			name: 'My group',
		},
		onSubmit: async ({ value }) => {
			setSaveError(null)

			try {
				await addGroupMutation.mutateAsync({
					baseId: value.id,
					name: value.name,
				})
				setShow(false)
			} catch (err: any) {
				setSaveError(`Failed to add group: ${err?.message ?? err?.toString() ?? err}`)
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
		<CModalExt visible={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>Add Surface Group</h5>
			</CModalHeader>
			<CForm
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit().catch((err) => {
						console.error('Form submission error', err)
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
										<InlineHelpIcon className="ms-1">
											Display name for the group. This can be changed later
										</InlineHelpIcon>
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
									console.log('')
									if (!isSurfaceGroupIdValid(value))
										return 'Id must be alphanumeric and can contain underscores and dashes'
									if (!value) return 'Id cannot be empty'
									if (surfaces.store.has(`group:${value}`)) return 'Id already exists'
									return undefined
								},
							}}
							children={(field) => (
								<>
									<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
										Id
										<InlineHelpIcon className="ms-1">
											Id for the group, this is used for internal references. This cannot be changed once set.
										</InlineHelpIcon>
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
									onClick={() => {
										form.handleSubmit().catch((err) => {
											console.error('Form submission error', err)
										})
									}}
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
})
