import { faDownload, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFormHook, createFormHookContexts, formOptions } from '@tanstack/react-form'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import type { ClientImportOrResetSelection, ResetType } from '@companion-app/shared/Model/ImportExport.js'
import { StaticAlert } from '~/Components/Alert'
import { Button, LinkButtonExternal } from '~/Components/Button'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { Form } from '~/Components/Form.js'
import { InlineHelpIcon } from '~/Components/InlineHelp'
import { Modal } from '~/Components/Modal'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

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
	imageLibrary: 'reset',
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

export const ResetWizardModal = observer(function ResetWizardModal() {
	const { notifier } = useContext(RootAppStoreContext)

	const [currentStep, setCurrentStep] = useState(1)
	const maxSteps = 3
	const applyStep = 3
	const [show, setShow] = useState(false)

	const resetConfigMutation = useMutationExt(trpc.importExport.resetConfiguration.mutationOptions())

	const form = useAppForm({
		...resetFormOpts,
		onSubmit: async ({ value }) => {
			setCurrentStep(maxSteps) // Move to completion step

			try {
				const status = await resetConfigMutation.mutateAsync({ config: value })
				if (status !== 'ok') {
					notifier.show(`Reset failed`, `An unspecified error occurred during the reset. Please try again.`, 10000)
				} else {
					doClose()
				}
			} catch (e) {
				notifier.show(`Reset failed`, 'An error occurred: ' + e, 10000)
			}
		},
	})

	const onOpenChange = useCallback(
		(open: boolean) => {
			if (open) {
				form.reset()
				setCurrentStep(1)
			}

			setShow(open)
		},
		[form]
	)
	const doClose = useCallback(() => onOpenChange(false), [onOpenChange])

	const onOpenChangeComplete = useCallback(
		(open: boolean) => {
			// Clear form and reset step when modal is closed
			if (!open) {
				form.reset()
				setCurrentStep(1)
			}
		},
		[form]
	)

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

	const buttonRef = useRef<HTMLButtonElement>(null)

	let nextButton
	switch (currentStep) {
		case applyStep:
			nextButton = (
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
					children={([canSubmit, isSubmitting]) => (
						<Button ref={buttonRef} color="primary" type="submit" disabled={!canSubmit || isSubmitting}>
							Apply {isSubmitting ? '...' : ''}
						</Button>
					)}
				/>
			)
			break
		case maxSteps:
			nextButton = (
				<Button ref={buttonRef} color="primary" onClick={doClose}>
					Finish
				</Button>
			)
			break
		default:
			nextButton = (
				<Button ref={buttonRef} color="primary" onClick={doNextStep}>
					Next
				</Button>
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
		<Modal.Root open={show} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete} disableDismiss>
			<Modal.Trigger color="danger">
				<FontAwesomeIcon icon={faTrashAlt} className="me-2" />
				Reset configuration
			</Modal.Trigger>

			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup initialFocus={buttonRef}>
						<Modal.Header closeButton>
							<Modal.Title>
								<img src={makeAbsolutePath('/img/icons/48x48.png')} height="30" alt="logo" className="me-2" />
								Reset Configuration
							</Modal.Title>
						</Modal.Header>

						<form.AppForm>
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
								<Modal.Body>{modalBody}</Modal.Body>
								<Modal.Footer>
									{currentStep <= applyStep && (
										<>
											<Modal.Close>Cancel</Modal.Close>
											<Button color="secondary" disabled={currentStep === 1} onClick={doPrevStep}>
												Back
											</Button>
										</>
									)}
									{nextButton}
								</Modal.Footer>
							</Form>
						</form.AppForm>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})

function ResetBeginStep() {
	return (
		<div>
			<p style={{ marginTop: 0 }}>
				Proceeding will allow you to reset some or all major components of this Companion installation.
			</p>
			<p>It is recommended to export the system configuration first.</p>

			<LinkButtonExternal color="success" href={makeAbsolutePath('/int/export/full')}>
				<FontAwesomeIcon icon={faDownload} /> Export
			</LinkButtonExternal>
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

				<div className="ms-2 mb-1">
					<form.AppField name="connections">{(field) => <field.ResetToggleField label="Connections" />}</form.AppField>
					<form.Subscribe
						selector={(state: any) => [state.values.connections, state.values.buttons, state.values.triggers]}
						children={([connections, buttons, triggers]: any[]) =>
							connections !== 'unchanged' && !(buttons !== 'unchanged' && triggers !== 'unchanged') ? (
								<StaticAlert color="warning">
									Resetting 'Connections' will remove all actions, feedbacks, and triggers associated with the
									connections even if 'Buttons' and/or 'Triggers' are not also reset.
								</StaticAlert>
							) : null
						}
					/>
				</div>

				<div className="ms-2 mb-1">
					<form.AppField name="buttons">{(field) => <field.ResetToggleField label="Buttons" />}</form.AppField>
				</div>
				<div className="ms-2 mb-1">
					<form.AppField name="triggers">{(field) => <field.ResetToggleField label="Triggers" />}</form.AppField>
				</div>

				<div className="ms-2 mb-1">
					<form.AppField name="customVariables">
						{(field) => <field.ResetToggleField label="Custom Variables" />}
					</form.AppField>
					<form.Subscribe
						selector={(state: any) => [state.values.customVariables, state.values.buttons, state.values.triggers]}
						children={([customVariables, buttons, triggers]: any[]) =>
							customVariables !== 'unchanged' && !(buttons !== 'unchanged' && triggers !== 'unchanged') ? (
								<StaticAlert color="warning">
									Resetting 'Custom Variables' without also resetting 'Buttons', and 'Triggers' that may utilize them
									can create an unstable environment.
								</StaticAlert>
							) : null
						}
					/>
				</div>
				<div className="ms-2 mb-1">
					<form.AppField name="expressionVariables">
						{(field) => <field.ResetToggleField label="Expression Variables" />}
					</form.AppField>
				</div>

				<div className="ms-2 mb-1">
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
				<div className="ms-2 mb-1">
					<form.AppField name="surfaces.known">
						{(field) => (
							<field.ResetToggleField
								className="ms-4"
								label={
									<>
										Known Surfaces
										<InlineHelpIcon className="ms-1">The list of known surfaces, and their settings</InlineHelpIcon>
									</>
								}
							/>
						)}
					</form.AppField>
				</div>
				<div className="ms-2 mb-1">
					<form.AppField name="surfaces.instances">
						{(field) => (
							<field.ResetToggleField
								className="ms-4"
								label={
									<>
										Surface Integrations
										<InlineHelpIcon className="ms-1">The configured surface integrations</InlineHelpIcon>
									</>
								}
							/>
						)}
					</form.AppField>
				</div>
				<div className="ms-2 mb-1">
					<form.AppField name="surfaces.remote">
						{(field) => (
							<field.ResetToggleField
								className="ms-4"
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
					</form.AppField>
				</div>

				<div className="ms-2 mb-1">
					<form.AppField name="imageLibrary">
						{(field) => <field.ResetToggleField label="Image Library" />}
					</form.AppField>
				</div>

				<div className="ms-2 mb-1">
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
		<CheckboxInputFieldWithLabel
			className={className}
			value={field.state.value !== 'unchanged'}
			setValue={(val) => field.handleChange(val ? 'reset' : 'unchanged')}
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
		<CheckboxInputFieldWithLabel
			className={className}
			indeterminate={isAChildChecked && isAChildUnchecked}
			value={isAChildChecked}
			setValue={(val) => field.handleChange(val ? defaultChecked : defaultUnchecked)}
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

					if (config.imageLibrary !== 'unchanged') {
						changes.push(<li key="imageLibrary">All images in the image library.</li>)
					}

					if (config.userconfig !== 'unchanged') {
						changes.push(<li key="userconfig">All settings, including enabled remote control services.</li>)
					}

					return (
						<div>
							<h5>Review Changes</h5>
							<p>The following data will be reset:</p>

							{changes.length > 0 ? (
								<>
									<ul>{changes}</ul>
									<StaticAlert color="danger">Proceeding will permanently clear the above data.</StaticAlert>
								</>
							) : (
								<ul>
									<li>No changes to the configuration will be made.</li>
								</ul>
							)}
						</div>
					)
				}}
			/>
		)
	},
})
