import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useForm } from '@tanstack/react-form'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId, useRef, useState } from 'react'
import type { ClientExportSelection } from '@companion-app/shared/Model/ImportExport.js'
import { flattenToQueryParams } from '@companion-app/shared/Util/QueryParamUtil.js'
import { Button } from '~/Components/Button'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { Modal } from '~/Components/Modal.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ExportFormatDefault, SelectExportFormat } from './ExportFormat.js'

export const ExportWizardModal = observer(function ExportWizardModal() {
	const { userConfig } = useContext(RootAppStoreContext)

	const [show, setShow] = useState(false)

	const buttonRef = useRef<HTMLButtonElement>(null)

	const defaultFormValues: ClientExportSelection = {
		connections: true,
		buttons: true,
		surfaces: {
			known: true,
			instances: true,
			remote: true,
		},
		triggers: true,
		customVariables: true,
		expressionVariables: true,
		includeSecrets: true,
		imageLibrary: true,
		// userconfig: true,
		format: ExportFormatDefault,
		filename: userConfig.properties?.default_export_filename ?? '',
	}

	const form = useForm({
		defaultValues: defaultFormValues,
		onSubmit: async ({ value }) => {
			// Use generic flattening function to convert nested object to dot-notation query params
			const flatParams = flattenToQueryParams(value)

			const params = new URLSearchParams()
			for (const [key, val] of Object.entries(flatParams)) {
				params.set(key, val)
			}

			const link = document.createElement('a')
			link.setAttribute('download', 'export.companionconfig')
			link.href = makeAbsolutePath(`/int/export/custom?${params}`)
			document.body.appendChild(link)
			link.click()
			link.remove()

			setShow(false)
		},
	})

	const onOpenChangeComplete = useCallback(
		(open: boolean) => {
			// Clear form data when modal is closed
			if (!open) {
				form.reset()
			}
		},
		[form]
	)

	const onOpenChange = useCallback(
		(open: boolean) => {
			if (open) {
				form.reset()
			}

			setShow(open)
		},
		[form]
	)

	const exportFormatId = useId()
	const exportNameId = useId()

	return (
		<Modal.Root open={show} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Trigger color="success">
				<FontAwesomeIcon icon={faDownload} className="me-2" />
				Export configuration
			</Modal.Trigger>

			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup initialFocus={buttonRef}>
						<Modal.Header closeButton>
							<Modal.Title>
								<img src={makeAbsolutePath('/img/icons/48x48.png')} height="30" alt="logo" className="me-2" />
								Export Configuration
							</Modal.Title>
						</Modal.Header>
						<Form
							className={'flex-form'}
							onSubmit={(e) => {
								e.preventDefault()
								e.stopPropagation()
								form.handleSubmit().catch((err) => {
									console.error('Form submission error', err)
								})
							}}
						>
							<Modal.Body>
								<div>
									<h5>Export Options</h5>
									<p>Please select the components you'd like to export:</p>
									<div className="ms-2 mb-1">
										<form.Field
											name="connections"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													id="wizard_connections"
													value={field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label="Connections"
												/>
											)}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="includeSecrets"
											children={(field) => (
												<form.Subscribe
													selector={(state) => [state.values.connections]}
													children={([connections]) => (
														<CheckboxInputFieldWithLabel
															id="wizard_include_secrets"
															className="ms-4"
															value={field.state.value}
															setValue={field.handleChange}
															disabled={!connections}
															onBlur={field.handleBlur}
															label={
																<>
																	Include secrets
																	<InlineHelpIcon className="ms-1">
																		Some connections have secret values that can be omitted from the export. Not all
																		modules are compatible with this.
																	</InlineHelpIcon>
																</>
															}
														/>
													)}
												/>
											)}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="buttons"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													value={field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label="Buttons"
												/>
											)}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="triggers"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													value={field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label="Triggers"
												/>
											)}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="customVariables"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													value={field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label="Custom Variables"
												/>
											)}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="expressionVariables"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													value={field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label="Expression Variables"
												/>
											)}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="surfaces"
											children={(field) => {
												const isAChildChecked = !!field.state.value && Object.values(field.state.value).some((v) => !!v)
												const isAChildUnchecked =
													!!field.state.value && Object.values(field.state.value).some((v) => !v)

												return (
													<CheckboxInputFieldWithLabel
														indeterminate={isAChildChecked && isAChildUnchecked}
														value={isAChildChecked}
														setValue={(value) =>
															field.handleChange(
																value
																	? {
																			known: true,
																			instances: true,
																			remote: true,
																		}
																	: null
															)
														}
														onBlur={field.handleBlur}
														label="Surfaces"
													/>
												)
											}}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="surfaces.known"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													className="ms-4"
													value={!!field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label={
														<>
															Known Surfaces
															<InlineHelpIcon className="ms-1">
																The list of known surfaces, and their settings
															</InlineHelpIcon>
														</>
													}
												/>
											)}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="surfaces.instances"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													className="ms-4"
													value={!!field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label={
														<>
															Surface Integrations
															<InlineHelpIcon className="ms-1">The configured surface integrations</InlineHelpIcon>
														</>
													}
												/>
											)}
										/>
									</div>
									<div className="ms-2 mb-1">
										<form.Field
											name="surfaces.remote"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													className="ms-4"
													value={!!field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label={
														<>
															Remote Surfaces
															<InlineHelpIcon className="ms-1">
																Connections for surfaces that are connected remotely
															</InlineHelpIcon>
														</>
													}
												/>
											)}
										/>
									</div>

									<div className="ms-2 mb-1">
										<form.Field
											name="imageLibrary"
											children={(field) => (
												<CheckboxInputFieldWithLabel
													value={field.state.value}
													setValue={field.handleChange}
													onBlur={field.handleBlur}
													label="Image Library"
												/>
											)}
										/>
									</div>

									<div style={{ paddingTop: '1em' }}>
										<FormLabel htmlFor={exportFormatId}>File format</FormLabel>
										<form.Field
											name="format"
											children={(field) => (
												<SelectExportFormat
													id={exportFormatId}
													value={field.state.value}
													setValue={(val) => field.handleChange(val)}
												/>
											)}
										/>
									</div>
									<div style={{ paddingTop: '1em' }}>
										<FormLabel htmlFor={exportNameId}>File name</FormLabel>
										<form.Field
											name="filename"
											children={(field) => (
												<TextInputField
													id={exportNameId}
													value={String(field.state.value)}
													setValue={(val) => field.handleChange(val)}
													useVariables={true}
												/>
											)}
										/>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<form.Subscribe
									selector={(state) => [state.canSubmit, state.isSubmitting]}
									children={([canSubmit, isSubmitting]) => (
										<>
											<Modal.Close disabled={isSubmitting}>Close </Modal.Close>
											<Button ref={buttonRef} color="primary" disabled={!canSubmit || isSubmitting} type="submit">
												Download {isSubmitting ? '...' : ''}
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
