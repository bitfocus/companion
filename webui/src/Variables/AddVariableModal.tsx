import { useForm } from '@tanstack/react-form'
import { forwardRef, useCallback, useId, useImperativeHandle, useState } from 'react'
import { StaticAlert } from '~/Components/Alert'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { Modal } from '~/Components/Modal'
import { TextInputFieldSimple } from '~/Components/TextInputField'

export interface AddVariableModalRef {
	show(): void
}

interface AddVariableModalProps {
	title: string
	nameHelp: string
	/** Returns an error message for an unacceptable name, or undefined if it is fine */
	validateName: (name: string) => string | undefined
	/** Creates the variable. Throws (or returns an error string) on failure */
	create: (name: string) => Promise<string | null | void>
}

export const AddVariableModal = forwardRef<AddVariableModalRef, AddVariableModalProps>(function AddVariableModal(
	{ title, nameHelp, validateName, create },
	ref
) {
	const [show, setShow] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)

	const form = useForm({
		defaultValues: {
			name: '',
		},
		onSubmit: async ({ value }) => {
			setSaveError(null)

			try {
				const res = await create(value.name)
				if (res) {
					setSaveError(`Failed to create variable: ${res}`)
					return
				}

				setShow(false)
			} catch (err: any) {
				setSaveError(`Failed to create variable: ${err?.message ?? err?.toString() ?? err}`)
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

	return (
		<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup>
						<Modal.Header closeButton>
							<Modal.Title>{title}</Modal.Title>
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
								<Grid.Row className="sm:gap-2">
									{saveError && (
										<Grid.Col className="fieldtype-textinput" sm={12}>
											<StaticAlert color="danger">{saveError}</StaticAlert>
										</Grid.Col>
									)}

									<form.Field
										name="name"
										validators={{
											onChange: ({ value }) => {
												if (!value) return 'Name cannot be empty'
												return validateName(value)
											},
										}}
										children={(field) => (
											<>
												<FormLabel htmlFor={nameFieldId} sm={4} column="sm">
													Name
													<InlineHelpIcon className="ms-1">{nameHelp}</InlineHelpIcon>
												</FormLabel>
												<Grid.Col className="fieldtype-textinput" sm={8}>
													<TextInputFieldSimple
														id={nameFieldId}
														value={field.state.value}
														setValue={field.handleChange}
														checkValid={field.state.meta.errors.length === 0}
														onBlur={field.handleBlur}
														placeholder="variableName"
														immediateValue
														autoFocus
													/>
													{field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
														<StaticAlert color="warning" className="mt-2">
															{field.state.meta.errors}
														</StaticAlert>
													)}
												</Grid.Col>
											</>
										)}
									/>
								</Grid.Row>
							</Modal.Body>
							<Modal.Footer>
								<form.Subscribe
									selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine]}
									children={([canSubmit, isSubmitting, isPristine]) => (
										<>
											<Modal.Close disabled={isSubmitting}>Cancel</Modal.Close>
											<Button
												color="primary"
												className="md:me-1"
												disabled={!canSubmit || isSubmitting || isPristine}
												type="submit"
											>
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
