import { CCol, CRow } from '@coreui/react'
import { useForm } from '@tanstack/react-form'
import { nanoid } from 'nanoid'
import { forwardRef, useCallback, useContext, useId, useImperativeHandle, useState } from 'react'
import { isSurfaceGroupIdValid } from '@companion-app/shared/Label.js'
import { StaticAlert } from '~/Components/Alert'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { Modal } from '~/Components/Modal'
import { TextInputFieldSimple } from '~/Components/TextInputField'
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

	const onOpenChangeComplete = useCallback(
		(open: boolean) => {
			if (!open) {
				form.reset()
				setSaveError(null)
			}
		},
		[form]
	)

	const nameFieldId = useId()
	const idFieldId = useId()

	return (
		<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup>
						<Modal.Header closeButton>
							<Modal.Title>Add Surface Group</Modal.Title>
						</Modal.Header>
						<Form
							onSubmit={(e) => {
								e.preventDefault()
								e.stopPropagation()
								form.handleSubmit().catch((err) => {
									console.error('Form submission error', err)
								})
							}}
						>
							<Modal.Body>
								<CRow className="g-sm-2">
									{saveError && (
										<CCol className={`fieldtype-textinput`} sm={12}>
											<StaticAlert color="danger">{saveError}</StaticAlert>
										</CCol>
									)}

									<form.Field
										name="name"
										children={(field) => (
											<>
												<FormLabel htmlFor={nameFieldId} className="col-sm-4 col-form-label col-form-label-sm">
													Name
													<InlineHelpIcon className="ms-1">
														Display name for the group. This can be changed later
													</InlineHelpIcon>
												</FormLabel>
												<CCol className={`fieldtype-textinput`} sm={8}>
													<TextInputFieldSimple
														id={nameFieldId}
														value={field.state.value}
														setValue={field.handleChange}
														checkValid={field.state.meta.errors.length === 0}
														onBlur={field.handleBlur}
														immediateValue
													/>
												</CCol>
											</>
										)}
									/>

									<form.Field
										name="id"
										validators={{
											onChange: ({ value }) => {
												if (!isSurfaceGroupIdValid(value))
													return 'Id must be alphanumeric and can contain underscores and dashes'
												if (!value) return 'Id cannot be empty'
												if (surfaces.store.has(`group:${value}`)) return 'Id already exists'
												return undefined
											},
										}}
										children={(field) => (
											<>
												<FormLabel htmlFor={idFieldId} className="col-sm-4 col-form-label col-form-label-sm">
													Id
													<InlineHelpIcon className="ms-1">
														Id for the group, this is used for internal references. This cannot be changed once set.
													</InlineHelpIcon>
												</FormLabel>
												<CCol className={`fieldtype-textinput`} sm={8}>
													<TextInputFieldSimple
														id={idFieldId}
														value={field.state.value}
														setValue={field.handleChange}
														checkValid={field.state.meta.errors.length === 0}
														onBlur={field.handleBlur}
														immediateValue
													/>
													{field.state.meta.errors.length > 0 && (
														<StaticAlert color="warning" className="mt-2">
															{field.state.meta.errors}
														</StaticAlert>
													)}
												</CCol>
											</>
										)}
									/>
								</CRow>
							</Modal.Body>
							<Modal.Footer>
								<form.Subscribe
									selector={(state) => [state.canSubmit, state.isSubmitting]}
									children={([canSubmit, isSubmitting]) => (
										<>
											<Modal.Close disabled={isSubmitting}>Cancel</Modal.Close>
											<Button color="primary" className="me-md-1" disabled={!canSubmit || isSubmitting} type="submit">
												Add {isSubmitting ? '...' : ''}
											</Button>
										</>
									)}
								/>
							</Modal.Footer>
						</Form>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})
