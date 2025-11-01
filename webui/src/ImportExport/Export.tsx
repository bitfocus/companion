import React, { forwardRef, useCallback, useImperativeHandle, useState, useContext } from 'react'
import { CButton, CForm, CFormCheck, CFormLabel, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { makeAbsolutePath } from '~/Resources/util.js'
import { ExportFormatDefault, SelectExportFormat } from './ExportFormat.js'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import type { ClientExportSelection } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { observer } from 'mobx-react-lite'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { useForm } from '@tanstack/react-form'
import { flattenToQueryParams } from '@companion-app/shared/Util/QueryParamUtil.js'

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
								<div className="indent3">
									<form.Field
										name="connections"
										children={(field) => (
											<CFormCheck
												id="wizard_connections"
												checked={field.state.value}
												onChange={(e) => field.handleChange(e.currentTarget.checked)}
												onBlur={field.handleBlur}
												label="Connections"
											/>
										)}
									/>
								</div>
								<div className="indent3">
									<form.Field
										name="includeSecrets"
										children={(field) => (
											<form.Subscribe
												selector={(state) => [state.values.connections]}
												children={([connections]) => (
													<CFormCheck
														id="wizard_include_secrets"
														className="ms-4"
														checked={field.state.value}
														disabled={!connections}
														onChange={(e) => field.handleChange(e.currentTarget.checked)}
														onBlur={field.handleBlur}
														label={
															<>
																Include secrets
																<InlineHelp help="Some connections have secret values that can be omitted from the export. Not all modules are compatible with this">
																	<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
																</InlineHelp>
															</>
														}
													/>
												)}
											/>
										)}
									/>
								</div>
								<div className="indent3">
									<form.Field
										name="buttons"
										children={(field) => (
											<CFormCheck
												checked={field.state.value}
												onChange={(e) => field.handleChange(e.currentTarget.checked)}
												onBlur={field.handleBlur}
												label="Buttons"
											/>
										)}
									/>
								</div>
								<div className="indent3">
									<form.Field
										name="triggers"
										children={(field) => (
											<CFormCheck
												checked={field.state.value}
												onChange={(e) => field.handleChange(e.currentTarget.checked)}
												onBlur={field.handleBlur}
												label="Triggers"
											/>
										)}
									/>
								</div>
								<div className="indent3">
									<form.Field
										name="customVariables"
										children={(field) => (
											<CFormCheck
												checked={field.state.value}
												onChange={(e) => field.handleChange(e.currentTarget.checked)}
												onBlur={field.handleBlur}
												label="Custom Variables"
											/>
										)}
									/>
								</div>
								<div className="indent3">
									<form.Field
										name="expressionVariables"
										children={(field) => (
											<CFormCheck
												checked={field.state.value}
												onChange={(e) => field.handleChange(e.currentTarget.checked)}
												onBlur={field.handleBlur}
												label="Expression Variables"
											/>
										)}
									/>
								</div>
								<div className="indent3">
									<form.Field
										name="surfaces"
										children={(field) => {
											const isAChildChecked = !!field.state.value && Object.values(field.state.value).some((v) => !!v)
											const isAChildUnchecked = !!field.state.value && Object.values(field.state.value).some((v) => !v)

											return (
												<CFormCheck
													indeterminate={isAChildChecked && isAChildUnchecked}
													checked={isAChildChecked}
													onChange={(e) =>
														field.handleChange(
															e.currentTarget.checked
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
								<div className="indent3">
									<form.Field
										name="surfaces.known"
										children={(field) => (
											<CFormCheck
												className="ms-4"
												checked={!!field.state.value}
												onChange={(e) => field.handleChange(e.currentTarget.checked)}
												onBlur={field.handleBlur}
												label={
													<>
														Known Surfaces
														<InlineHelp help="The list of known connections, and their settings">
															<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
														</InlineHelp>
													</>
												}
											/>
										)}
									/>
								</div>
								<div className="indent3">
									<form.Field
										name="surfaces.instances"
										children={(field) => (
											<CFormCheck
												className="ms-4"
												checked={!!field.state.value}
												onChange={(e) => field.handleChange(e.currentTarget.checked)}
												onBlur={field.handleBlur}
												label={
													<>
														Surface Instances
														<InlineHelp help="The configured surface instances">
															<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
														</InlineHelp>
													</>
												}
											/>
										)}
									/>
								</div>
								<div className="indent3">
									<form.Field
										name="surfaces.remote"
										children={(field) => (
											<CFormCheck
												className="ms-4"
												checked={!!field.state.value}
												onChange={(e) => field.handleChange(e.currentTarget.checked)}
												onBlur={field.handleBlur}
												label={
													<>
														Remote Surfaces
														<InlineHelp help="Connections for surfaces that are connected remotely">
															<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
														</InlineHelp>
													</>
												}
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
