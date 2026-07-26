import { faDownload, faKey } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useForm } from '@tanstack/react-form'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId, useRef, useState } from 'react'
import { ExportFormatDefault } from '@companion-app/shared/Model/ExportFormat.js'
import type { ClientExportSelection } from '@companion-app/shared/Model/ImportExport.js'
import { flattenToQueryParams } from '@companion-app/shared/Util/QueryParamUtil.js'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { Modal } from '~/Components/Modal.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CONFIG_OPTION_META, ConfigOptionRow, CONTENT_OPTION_KEYS, SURFACE_CHILD_OPTIONS } from './ConfigSelection.js'
import { SelectExportFormat } from './ExportFormat.js'

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
		format: userConfig.properties?.default_export_format ?? ExportFormatDefault,
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
								<div className="config-selection">
									<p className="config-selection-intro">Choose what to include in your export.</p>

									<div className="config-selection-section">
										<div className="config-selection-title">Connections</div>
										<div className="config-selection-list">
											<form.Field
												name="connections"
												children={(field) => (
													<ConfigOptionRow
														icon={CONFIG_OPTION_META.connections.icon}
														label={CONFIG_OPTION_META.connections.label}
														value={field.state.value}
														setValue={field.handleChange}
														onBlur={field.handleBlur}
													/>
												)}
											/>
											<form.Field
												name="includeSecrets"
												children={(field) => (
													<form.Subscribe
														selector={(state) => [state.values.connections]}
														children={([connections]) => (
															<ConfigOptionRow
																sub
																icon={faKey}
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
									</div>

									<div className="config-selection-section">
										<div className="config-selection-title">Content</div>
										<div className="config-selection-list">
											{CONTENT_OPTION_KEYS.map((key) => (
												<form.Field
													key={key}
													name={key}
													children={(field) => (
														<ConfigOptionRow
															icon={CONFIG_OPTION_META[key].icon}
															label={CONFIG_OPTION_META[key].label}
															value={!!field.state.value}
															setValue={field.handleChange}
															onBlur={field.handleBlur}
														/>
													)}
												/>
											))}
										</div>
									</div>

									<div className="config-selection-section">
										<div className="config-selection-title">Surfaces</div>
										<div className="config-selection-list">
											<form.Field
												name="surfaces"
												children={(field) => {
													const isAChildChecked =
														!!field.state.value && Object.values(field.state.value).some((v) => !!v)
													const isAChildUnchecked =
														!!field.state.value && Object.values(field.state.value).some((v) => !v)

													return (
														<ConfigOptionRow
															icon={CONFIG_OPTION_META.surfaces.icon}
															label={CONFIG_OPTION_META.surfaces.label}
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
														/>
													)
												}}
											/>
											{SURFACE_CHILD_OPTIONS.map((child) => (
												<form.Field
													key={child.key}
													name={`surfaces.${child.key}`}
													children={(field) => (
														<ConfigOptionRow
															sub
															icon={child.icon}
															label={child.label}
															value={!!field.state.value}
															setValue={field.handleChange}
															onBlur={field.handleBlur}
														/>
													)}
												/>
											))}
										</div>
									</div>

									<div className="config-selection-section">
										<div className="config-selection-title">Output</div>
										<div className="export-output">
											<div className="export-output-field">
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
											<div className="export-output-field">
												<FormLabel htmlFor={exportNameId}>File name</FormLabel>
												<form.Field
													name="filename"
													children={(field) => (
														<TextInputField
															id={exportNameId}
															value={String(field.state.value)}
															setValue={(val) => field.handleChange(val)}
															useVariables
															immediateValue
														/>
													)}
												/>
											</div>
										</div>
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
