import React, { FormEvent, forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { CButton, CForm, CModal, CModalBody, CModalFooter, CModalHeader, CAlert, CFormCheck } from '@coreui/react'
import { makeAbsolutePath, PreventDefaultHandler } from '~/Resources/util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import type { ClientResetSelection } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export interface ResetWizardModalRef {
	show(): void
}

export const ResetWizardModal = forwardRef<ResetWizardModalRef>(function WizardModal(_props, ref) {
	const { notifier } = useContext(RootAppStoreContext)

	const [currentStep, setCurrentStep] = useState(1)
	const maxSteps = 3
	const applyStep = 3
	const [clear, setClear] = useState(true)
	const [show, setShow] = useState(false)
	const [config, setConfig] = useState<ClientResetSelection>({
		connections: true,
		buttons: true,
		surfaces: true,
		triggers: true,
		customVariables: true,
		userconfig: true,
		imageLibrary: true,
	})

	const doClose = useCallback(() => {
		setShow(false)
		setClear(true)
	}, [])

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

	const resetConfigMutation = useMutationExt(trpc.importExport.resetConfiguration.mutationOptions())
	const doSave = useCallback(
		(e: FormEvent) => {
			e.preventDefault()

			resetConfigMutation // TODO: 30s timeout?
				.mutateAsync(config)
				.then((status) => {
					if (status !== 'ok') {
						notifier.current?.show(
							`Reset failed`,
							`An unspecified error occurred during the reset.  Please try again.`,
							10000
						)
					}

					doClose()
				})
				.catch((e) => {
					notifier.current?.show(`Reset failed`, 'An error occurred:' + e, 10000)
					doNextStep()
				})

			doNextStep()
		},
		[resetConfigMutation, notifier, config, doNextStep, doClose]
	)

	const setValue = (key: keyof ClientResetSelection, value: boolean) => {
		setConfig((oldState: ClientResetSelection) => ({
			...oldState,
			[key]: value,
		}))
	}

	useImperativeHandle(
		ref,
		() => ({
			show() {
				if (clear) {
					setConfig({
						connections: true,
						buttons: true,
						surfaces: true,
						triggers: true,
						customVariables: true,
						userconfig: true,
						imageLibrary: true,
					})

					setCurrentStep(1)
				}
				setShow(true)
				setClear(false)
			},
		}),
		[clear]
	)

	let nextButton
	switch (currentStep) {
		case applyStep:
			nextButton = (
				<CButton color="primary" onClick={doSave}>
					Apply
				</CButton>
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
			modalBody = <ResetOptionsStep config={config} setValue={setValue} />
			break
		case 3:
			modalBody = <ResetApplyStep config={config} />
			break
		default:
	}

	return (
		<CModal visible={show} onClose={doClose} className={'wizard'} backdrop="static">
			<CForm onSubmit={PreventDefaultHandler}>
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
			</CForm>
		</CModal>
	)
})

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

interface ResetOptionsStepProps {
	config: ClientResetSelection
	setValue: (key: keyof ClientResetSelection, value: boolean) => void
}

function ResetOptionsStep({ config, setValue }: ResetOptionsStepProps) {
	return (
		<div>
			<h5>Reset Options</h5>
			<p>Please select the components you'd like to reset.</p>
			<div className="indent3">
				<CFormCheck
					checked={config.connections}
					onChange={(e) => setValue('connections', e.currentTarget.checked)}
					label="Connections"
				/>
				{config.connections && !(config.buttons && config.triggers) ? (
					<CAlert color="warning">
						Resetting 'Connections' will remove all actions, feedbacks, and triggers associated with the connections
						even if 'Buttons' and/or 'Triggers' are not also reset.
					</CAlert>
				) : (
					''
				)}
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.buttons}
					onChange={(e) => setValue('buttons', e.currentTarget.checked)}
					label="Buttons"
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.triggers}
					onChange={(e) => setValue('triggers', e.currentTarget.checked)}
					label="Triggers"
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.customVariables}
					onChange={(e) => setValue('customVariables', e.currentTarget.checked)}
					label="Custom Variables"
				/>
				{config.customVariables && !(config.buttons && config.triggers) ? (
					<CAlert color="warning">
						Resetting 'Custom Variables' without also resetting 'Buttons', and 'Triggers' that may utilize them can
						create an unstable environment.
					</CAlert>
				) : (
					''
				)}
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.surfaces}
					onChange={(e) => setValue('surfaces', e.currentTarget.checked)}
					label="Surfaces"
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.userconfig}
					onChange={(e) => setValue('userconfig', e.currentTarget.checked)}
					label="Settings"
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.imageLibrary}
					onChange={(e) => setValue('imageLibrary', e.currentTarget.checked)}
					label="Image Library"
				/>
			</div>
		</div>
	)
}

interface ResetApplyStepProps {
	config: ClientResetSelection
}

function ResetApplyStep({ config }: ResetApplyStepProps) {
	const changes = []

	if (config.connections && !config.buttons && !config.triggers) {
		changes.push(<li key="connections">All connections including their actions, feedbacks, and triggers.</li>)
	} else if (config.connections && !config.buttons) {
		changes.push(<li key="connections">All connections including their button actions and feedbacks.</li>)
	} else if (config.connections && !config.triggers) {
		changes.push(<li key="connections">All connections including their triggers and trigger actions.</li>)
	} else if (config.connections) {
		changes.push(<li key="connections">All connections.</li>)
	}

	if (config.buttons) {
		changes.push(<li key="buttons">All button styles, actions, and feedbacks.</li>)
	}

	if (config.surfaces) {
		changes.push(<li key="surfaces">All surface settings.</li>)
	}

	if (config.triggers) {
		changes.push(<li key="triggers">All triggers.</li>)
	}

	if (config.customVariables) {
		changes.push(<li key="custom-variables">All custom variables.</li>)
	}

	if (config.userconfig) {
		changes.push(<li key="userconfig">All settings, including enabled remote control services.</li>)
	}

	if (config.imageLibrary) {
		changes.push(<li key="imageLibrary">All images in the image library.</li>)
	}

	if (changes.length === 0) {
		changes.push(<li key="no-change">No changes to the configuration will be made.</li>)
	}

	return (
		<div>
			<h5>Review Changes</h5>
			<p>The following data will be reset:</p>
			<ul>{changes}</ul>
			{changes.length > 0 ? <CAlert color="danger">Proceeding will permanently clear the above data.</CAlert> : ''}
		</div>
	)
}
