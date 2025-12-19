import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CAlert, CFormCheck } from '@coreui/react'
import { makeAbsolutePath } from '~/Resources/util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import type { ResetType, ClientImportOrResetSelection } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { createFormHook, createFormHookContexts, formOptions } from '@tanstack/react-form'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { observer } from 'mobx-react-lite'
import { InlineHelp } from '~/Components/InlineHelp'

export interface ResetWizardModalRef {
	show(): void
}

const defaultFullResetConfig: ClientImportOrResetSelection = {
	connections: 'reset',
	buttons: 'reset',
	surfaces: {
		known: 'reset',
		instances: 'reset',
		remote: 'reset',
	},
	triggers: 'reset',
	customVariables: 'reset',
	expressionVariables: 'reset',
	userconfig: 'reset',
}

const { fieldContext, useFieldContext, formContext } = createFormHookContexts()

const resetFormOpts = formOptions({
	defaultValues: defaultFullResetConfig,
})

const { useAppForm, withForm } = createFormHook({
	fieldComponents: {
		ResetToggleField,
		ResetToggleGroup,
	},
	formComponents: {
		// 	FormSubmitButton,
	},
	fieldContext,
	formContext,
})

export const ResetWizardModal = observer(
	forwardRef<ResetWizardModalRef>(function ResetWizardModal(_props, ref) {
		const { notifier } = useContext(RootAppStoreContext)

		const [currentStep, setCurrentStep] = useState(1)
		const maxSteps = 3
		const applyStep = 3
		const [show, setShow] = useState(false)
		const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null)

		const resetConfigMutation = useMutationExt(trpc.importExport.resetConfiguration.mutationOptions())

		const form = useAppForm({
			...resetFormOpts,
			onSubmit: async ({ value }) => {
				setCurrentStep(maxSteps) // Move to completion step

				try {
					const status = await resetConfigMutation.mutateAsync({ config: value })
					if (status !== 'ok') {
						notifier.show(`Reset failed`, `An unspecified error occurred during the reset. Please try again.`, 10000)
					}

					doClose()
				} catch (e) {
					notifier.show(`Reset failed`, 'An error occurred: ' + e, 10000)
				}
			},
		})

		const doClose = useCallback(() => {
			setShow(false)
			form.reset()
			setCurrentStep(1)
		}, [form])

		const doNextStep = useCallback(() => {
			let newStep = currentStep
			// Make sure step is set to something reasonable
			if (newStep >= maxSteps - 1) {
				newStep = maxSteps
			} else {
				newStep = newStep + 1
			}

			setCurrentStep(newStep)
		}, [currentStep, maxSteps])

		const doPrevStep = useCallback(() => {
			let newStep = currentStep
			if (newStep <= 1) {
				newStep = 1
			} else {
				newStep = newStep - 1
			}

			setCurrentStep(newStep)
		}, [currentStep])

		useImperativeHandle(
			ref,
			() => ({
				show() {
					form.reset()
					setCurrentStep(1)
					setShow(true)
				},
			}),
			[form]
		)

		let nextButton
		switch (currentStep) {
			case applyStep:
				nextButton = (
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
						children={([canSubmit, isSubmitting]) => (
							<CButton
								color="primary"
								disabled={!canSubmit || isSubmitting}
								onClick={() => {
									form.handleSubmit().catch((err) => {
										console.error('Form submission error', err)
									})
								}}
							>
								Apply {isSubmitting ? '...' : ''}
							</CButton>
						)}
					/>
				)
				break
			case maxSteps:
				nextButton = (
					<CButton color="primary" onClick={doClose}>
						Finish
					</CButton>
				)
				break
			default:
				nextButton = (
					<CButton color="primary" onClick={doNextStep}>
						Next
					</CButton>
				)
		}

		let modalBody
		switch (currentStep) {
			case 1:
				modalBody = <ResetBeginStep />
				break
			case 2:
				modalBody = <ResetOptionsStep form={form} />
				break
			case 3:
				modalBody = <ResetApplyStep form={form} />
				break
			default:
		}

		return (
			<CModal ref={setModalRef} visible={show} onClose={doClose} className={'wizard'} backdrop="static">
				<MenuPortalContext.Provider value={modalRef}>
					<form.AppForm>
						<form
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
									Reset Configuration
								</h2>
							</CModalHeader>
							<CModalBody>{modalBody}</CModalBody>
							<CModalFooter>
								{currentStep <= applyStep && (
									<>
										<CButton color="secondary" onClick={doClose}>
											Cancel
										</CButton>
										<CButton color="secondary" disabled={currentStep === 1} onClick={doPrevStep}>
											Back
										</CButton>
									</>
								)}
								{nextButton}
							</CModalFooter>
						</form>
					</form.AppForm>
				</MenuPortalContext.Provider>
			</CModal>
		)
	})
)

function ResetBeginStep() {
	return (
		<div>
			<p style={{ marginTop: 0 }}>
				Proceeding will allow you to reset some or all major components of this Companion installation.
			</p>
			<p>It is recommended to export the system configuration first.</p>

			<CButton color="success" href={makeAbsolutePath('/int/export/full')} target="_blank">
				<FontAwesomeIcon icon={faDownload} /> Export
			</CButton>
		</div>
	)
}

const ResetOptionsStep = withForm({
	defaultValues: defaultFullResetConfig, // Just for types
	render: function ResetOptionsStep({ form }) {
		return (
			<div>
				<h5>Reset Options</h5>
				<p>Please select the components you'd like to reset.</p>

				<div className="indent3">
					<form.AppField name="connections">{(field) => <field.ResetToggleField label="Connections" />}</form.AppField>
					<form.Subscribe
						selector={(state: any) => [state.values.connections, state.values.buttons, state.values.triggers]}
						children={([connections, buttons, triggers]: any[]) =>
							connections !== 'unchanged' && !(buttons !== 'unchanged' && triggers !== 'unchanged') ? (
								<CAlert color="warning">
									Resetting 'Connections' will remove all actions, feedbacks, and triggers associated with the
									connections even if 'Buttons' and/or 'Triggers' are not also reset.
								</CAlert>
							) : null
						}
					/>
				</div>

				<div className="indent3">
					<form.AppField name="buttons">{(field) => <field.ResetToggleField label="Buttons" />}</form.AppField>
				</div>
				<div className="indent3">
					<form.AppField name="triggers">{(field) => <field.ResetToggleField label="Triggers" />}</form.AppField>
				</div>

				<div className="indent3">
					<form.AppField name="customVariables">
						{(field) => <field.ResetToggleField label="Custom Variables" />}
					</form.AppField>
					<form.Subscribe
						selector={(state: any) => [state.values.customVariables, state.values.buttons, state.values.triggers]}
						children={([customVariables, buttons, triggers]: any[]) =>
							customVariables !== 'unchanged' && !(buttons !== 'unchanged' && triggers !== 'unchanged') ? (
								<CAlert color="warning">
									Resetting 'Custom Variables' without also resetting 'Buttons', and 'Triggers' that may utilize them
									can create an unstable environment.
								</CAlert>
							) : null
						}
					/>
				</div>
				<div className="indent3">
					<form.AppField name="expressionVariables">
						{(field) => <field.ResetToggleField label="Expression Variables" />}
					</form.AppField>
				</div>

				<div className="indent3">
					<form.AppField name="surfaces">
						{(field) => (
							<field.ResetToggleGroup
								label="Surfaces"
								defaultChecked={
									{
										known: 'reset',
										instances: 'reset',
										remote: 'reset',
									} satisfies ClientImportOrResetSelection['surfaces']
								}
								defaultUnchecked={
									{
										known: 'unchanged',
										instances: 'unchanged',
										remote: 'unchanged',
									} satisfies ClientImportOrResetSelection['surfaces']
								}
							/>
						)}
					</form.AppField>
				</div>
				<div className="indent3">
					<form.AppField name="surfaces.known">
						{(field) => (
							<field.ResetToggleField
								className="ms-4"
								label={
									<>
										Known Surfaces
										<InlineHelp help="The list of known surfaces, and their settings">
											<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
										</InlineHelp>
									</>
								}
							/>
						)}
					</form.AppField>
				</div>
				<div className="indent3">
					<form.AppField name="surfaces.instances">
						{(field) => (
							<field.ResetToggleField
								className="ms-4"
								label={
									<>
										Surface Integrations
										<InlineHelp help="The configured surface integrations">
											<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
										</InlineHelp>
									</>
								}
							/>
						)}
					</form.AppField>
				</div>
				<div className="indent3">
					<form.AppField name="surfaces.remote">
						{(field) => (
							<field.ResetToggleField
								className="ms-4"
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
					</form.AppField>
				</div>

				<div className="indent3">
					<form.AppField name="userconfig">{(field) => <field.ResetToggleField label="Settings" />}</form.AppField>
				</div>
			</div>
		)
	},
})

interface ResetToggleFieldProps {
	label: string | React.ReactNode
	className?: string
}
function ResetToggleField({ label, className }: ResetToggleFieldProps) {
	const field = useFieldContext<ResetType>()

	return (
		<CFormCheck
			className={className}
			checked={field.state.value !== 'unchanged'}
			onChange={(e) => field.handleChange(e.currentTarget.checked ? 'reset' : 'unchanged')}
			onBlur={field.handleBlur}
			label={label}
		/>
	)
}

interface ResetToggleGroupProps {
	label: string | React.ReactNode
	defaultChecked: Record<string, ResetType>
	defaultUnchecked: Record<string, ResetType>
	className?: string
}
function ResetToggleGroup({ label, defaultChecked, defaultUnchecked, className }: ResetToggleGroupProps) {
	const field = useFieldContext<Record<string, ResetType>>()

	const isAChildChecked = !!field.state.value && Object.values(field.state.value).some((v) => v !== 'unchanged')
	const isAChildUnchecked = !!field.state.value && Object.values(field.state.value).some((v) => v === 'unchanged')

	return (
		<CFormCheck
			className={className}
			indeterminate={isAChildChecked && isAChildUnchecked}
			checked={isAChildChecked}
			onChange={(e) => field.handleChange(e.currentTarget.checked ? defaultChecked : defaultUnchecked)}
			onBlur={field.handleBlur}
			label={label}
		/>
	)
}

const ResetApplyStep = withForm({
	defaultValues: defaultFullResetConfig, // Just for types
	render: function ResetApplyStep({ form }) {
		return (
			<form.Subscribe
				selector={(state) => [state.values]}
				children={([config]) => {
					const changes = []

					if (config.connections !== 'unchanged' && config.buttons === 'unchanged' && config.triggers === 'unchanged') {
						changes.push(<li key="connections">All connections including their actions, feedbacks, and triggers.</li>)
					} else if (config.connections !== 'unchanged' && config.buttons === 'unchanged') {
						changes.push(<li key="connections">All connections including their button actions and feedbacks.</li>)
					} else if (config.connections !== 'unchanged' && config.triggers === 'unchanged') {
						changes.push(<li key="connections">All connections including their triggers and trigger actions.</li>)
					} else if (config.connections !== 'unchanged') {
						changes.push(<li key="connections">All connections.</li>)
					}

					if (config.buttons !== 'unchanged') {
						changes.push(<li key="buttons">All button styles, actions, and feedbacks.</li>)
					}

					if (config.surfaces.known !== 'unchanged') {
						changes.push(<li key="surfaces">All surface settings.</li>)
					}

					if (config.triggers !== 'unchanged') {
						changes.push(<li key="triggers">All triggers.</li>)
					}

					if (config.customVariables !== 'unchanged') {
						changes.push(<li key="custom-variables">All custom variables.</li>)
					}

					if (config.expressionVariables !== 'unchanged') {
						changes.push(<li key="expression-variables">All expression variables.</li>)
					}

					if (config.userconfig !== 'unchanged') {
						changes.push(<li key="userconfig">All settings, including enabled remote control services.</li>)
					}

					if (changes.length === 0) {
						changes.push(<li key="no-change">No changes to the configuration will be made.</li>)
					}

					return (
						<div>
							<h5>Review Changes</h5>
							<p>The following data will be reset:</p>
							<ul>{changes}</ul>
							{changes.length > 0 ? (
								<CAlert color="danger">Proceeding will permanently clear the above data.</CAlert>
							) : null}
						</div>
					)
				}}
			/>
		)
	},
})
