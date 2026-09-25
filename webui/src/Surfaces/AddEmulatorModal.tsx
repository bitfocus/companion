import { useForm } from '@tanstack/react-form'
import { nanoid } from 'nanoid'
import { forwardRef, useCallback, useContext, useId, useImperativeHandle, useState } from 'react'
import { isEmulatorIdValid } from '@companion-app/shared/Label.js'
import { StaticAlert } from '~/Components/Alert'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { Modal } from '~/Components/Modal'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { TextInputFieldSimple } from '~/Components/TextInputField'
import { trpc, useMutationExt, type RouterInput } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

type EmulatorAddInput = RouterInput['surfaces']['emulatorAdd']

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

	const idFieldId = useId()
	const nameFieldId = useId()
	const rowsFieldId = useId()
	const columnsFieldId = useId()

	return (
		<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup>
						<Modal.Header closeButton>
							<Modal.Title>Add Emulator</Modal.Title>
						</Modal.Header>
						<Form
							onSubmit={(e) => {
								e.preventDefault()
								e.stopPropagation()
								form.handleSubmit().catch((err) => {
									console.error('Add emulator failed', err)
								})
							}}
						>
							<Modal.Body>
								<Grid.Row className="sm:gap-2">
									{saveError && (
										<Grid.Col className={`fieldtype-textinput`} sm={12}>
											<StaticAlert color="danger">{saveError}</StaticAlert>
										</Grid.Col>
									)}

									<Grid.Col sm={12} className="mb-2">
										<FormLabel
											htmlFor={undefined}
											className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block"
										>
											Device Presets
										</FormLabel>
										<div className="flex flex-wrap gap-1.5">
											{[
												{ label: 'Mini (3×2)', rows: 2, columns: 3 },
												{ label: 'Standard (5×3)', rows: 3, columns: 5 },
												{ label: 'XL (8×4)', rows: 4, columns: 8 },
												{ label: 'Plus (4×2)', rows: 2, columns: 4 },
												{ label: 'Loupedeck (4×3)', rows: 3, columns: 4 },
											].map((preset) => (
												<Button
													key={preset.label}
													color="secondary"
													size="sm"
													type="button"
													className="text-xs"
													onClick={() => {
														form.setFieldValue('rows', preset.rows)
														form.setFieldValue('columns', preset.columns)
														if (!form.getFieldValue('name')) {
															form.setFieldValue('name', `Emulator ${preset.label}`)
														}
													}}
												>
													{preset.label}
												</Button>
											))}
										</div>
									</Grid.Col>

									<form.Field
										name="name"
										children={(field) => (
											<>
												<FormLabel htmlFor={nameFieldId} sm={4} column="sm">
													Name
													<InlineHelpIcon className="ms-1">
														Display name for the emulator. This can be changed later
													</InlineHelpIcon>
												</FormLabel>
												<Grid.Col className={`fieldtype-textinput`} sm={8}>
													<TextInputFieldSimple
														id={nameFieldId}
														value={field.state.value}
														setValue={field.handleChange}
														checkValid={field.state.meta.errors.length === 0}
														onBlur={field.handleBlur}
														immediateValue
													/>
												</Grid.Col>
											</>
										)}
									/>

									<form.Field
										name="baseId"
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
												<FormLabel htmlFor={idFieldId} sm={4} column="sm">
													Id
													<InlineHelpIcon className="ms-1">
														Id for the emulator, this is used in the url and internally. This cannot be changed once
														set.
													</InlineHelpIcon>
												</FormLabel>
												<Grid.Col className={`fieldtype-textinput`} sm={8}>
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
												</Grid.Col>
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
												<FormLabel htmlFor={rowsFieldId} sm={4} column="sm">
													Rows
												</FormLabel>
												<Grid.Col className={`fieldtype-textinput`} sm={8}>
													<NumberInputField
														id={rowsFieldId}
														min={1}
														value={field.state.value}
														setValue={field.handleChange}
														onBlur={field.handleBlur}
														checkValid={field.state.meta.errors.length === 0}
														immediateValue
													/>
													{field.state.meta.errors.length > 0 && (
														<StaticAlert color="warning" className="mt-2">
															{field.state.meta.errors}
														</StaticAlert>
													)}
												</Grid.Col>
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
												<FormLabel htmlFor={columnsFieldId} sm={4} column="sm">
													Columns
												</FormLabel>
												<Grid.Col className={`fieldtype-textinput`} sm={8}>
													<NumberInputField
														id={columnsFieldId}
														min={1}
														value={field.state.value}
														setValue={field.handleChange}
														onBlur={field.handleBlur}
														checkValid={field.state.meta.errors.length === 0}
														immediateValue
													/>
													{field.state.meta.errors.length > 0 && (
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
									selector={(state) => [state.canSubmit, state.isSubmitting]}
									children={([canSubmit, isSubmitting]) => (
										<>
											<Modal.Close disabled={isSubmitting}>Cancel</Modal.Close>

											<Button color="primary" className="md:me-1" disabled={!canSubmit || isSubmitting} type="submit">
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
