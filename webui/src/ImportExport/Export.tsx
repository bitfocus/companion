import { CButton, CForm, CFormLabel, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { useForm } from '@tanstack/react-form'
import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import type { ClientExportSelection } from '@companion-app/shared/Model/ImportExport.js'
import { flattenToQueryParams } from '@companion-app/shared/Util/QueryParamUtil.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ExportFormatDefault, SelectExportFormat } from './ExportFormat.js'

export interface ExportWizardModalRef {
	show(): void
}

export const ExportWizardModal = observer(
	forwardRef<ExportWizardModalRef>(function ExportWizardModal(_props, ref) {
		const { userConfig } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)
		const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null)

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

		const doClose = useCallback(() => {
			setShow(false)
			form.reset()
		}, [form])

		useImperativeHandle(
			ref,
			() => ({
				show() {
					form.reset()
					setShow(true)
				},
			}),
			[form]
		)

		return (
			<CModal ref={setModalRef} visible={show} onClose={doClose} className={'wizard'} backdrop="static">
				<MenuPortalContext.Provider value={modalRef}>
					<CForm
						className={'flex-form'}
						onSubmit={(e) => {
							e.preventDefault()
							e.stopPropagation()
							form.handleSubmit().catch((err) => {
								console.error('Form submission error', err)
							})
						}}
					>
						<CModalHeader>
							<h2>
								<img src={makeAbsolutePath('/img/icons/48x48.png')} height="30" alt="logo" />
								Export Configuration
							</h2>
						</CModalHeader>
						<CModalBody>
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
											const isAChildUnchecked = !!field.state.value && Object.values(field.state.value).some((v) => !v)

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
									<CFormLabel>File format</CFormLabel>
									<form.Field
										name="format"
										children={(field) => (
											<SelectExportFormat value={field.state.value} setValue={(val) => field.handleChange(val)} />
										)}
									/>
								</div>
								<div style={{ paddingTop: '1em' }}>
									<CFormLabel>File name</CFormLabel>
									<form.Field
										name="filename"
										children={(field) => (
											<TextInputField
												value={String(field.state.value)}
												setValue={(val) => field.handleChange(val)}
												useVariables={true}
											/>
										)}
									/>
								</div>
							</div>
						</CModalBody>
						<CModalFooter>
							<form.Subscribe
								selector={(state) => [state.canSubmit, state.isSubmitting]}
								children={([canSubmit, isSubmitting]) => (
									<>
										<CButton color="secondary" onClick={doClose} disabled={isSubmitting}>
											Close
										</CButton>
										<CButton color="primary" disabled={!canSubmit || isSubmitting} type="submit">
											Download {isSubmitting ? '...' : ''}
										</CButton>
									</>
								)}
							/>
						</CModalFooter>
					</CForm>
				</MenuPortalContext.Provider>
			</CModal>
		)
	})
)
