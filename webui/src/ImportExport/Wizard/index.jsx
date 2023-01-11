import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { CButton, CForm, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { SocketContext, socketEmitPromise } from '../../util'
import { ResetBeginStep, ResetOptionsStep, ResetApplyStep } from './Reset'

export const WizardModal = forwardRef(function WizardModal(_props, ref) {
	const socket = useContext(SocketContext)
	const [currentStep, setCurrentStep] = useState(1)
	const [maxSteps, setMaxSteps] = useState(6)
	const [applyStep, setApplyStep] = useState(5)
	const [clear, setClear] = useState(true)
	const [show, setShow] = useState(false)
	const [config, setConfig] = useState({})
	const [applyError, setApplyError] = useState(null)
	const [wizardTitle, setWizardTitle] = useState(null)

	const [snapshot, setSnapshot] = useState(null)
	const [wizardMode, setWizardMode] = useState(null)
	const [instanceRemap, setInstanceRemap] = useState({})

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

	const doSave = useCallback(
		(e) => {
			e.preventDefault()

			switch (wizardMode) {
				case 'import_page':
					break
				case 'import_full':
					break
				case 'reset':
					socketEmitPromise(socket, 'loadsave:reset', [config], 30000)
						.then((status) => {
							if (status !== 'ok') {
								setApplyError('An unspecified error occurred during the reset.  Please try again.')
							}
							doNextStep()
						})
						.catch((e) => {
							setApplyError('An error occurred:', e)
							doNextStep()
						})
					break
				default:
			}

			doNextStep()
		},
		[socket, wizardMode, snapshot, config, doNextStep]
	)

	const setValue = (key, value) => {
		setConfig((oldState) => ({
			...oldState,
			[key]: value,
		}))
	}

	const setupWizard = useCallback((mode) => {
		setWizardMode(mode)

		switch (mode) {
			case 'import_page':
				setMaxSteps(6)
				setApplyStep(5)
				setWizardTitle('Import Wizard')
				break
			case 'import_full':
				setMaxSteps(4)
				setApplyStep(3)
				setWizardTitle('Import Wizard')
				break
			case 'reset':
				setMaxSteps(4)
				setApplyStep(3)
				setConfig({
					connections: true,
					buttons: true,
					surfaces: true,
					triggers: true,
					customVariables: true,
					userconfig: true,
				})
				setWizardTitle('Reset Configuration Wizard')
				break
			default:
		}
	}, [])

	useImperativeHandle(
		ref,
		() => ({
			show(mode, snaphsot, instanceRemap) {
				if (clear) {
					setupWizard(mode)
					setSnapshot(snaphsot)
					setInstanceRemap(instanceRemap)
					setCurrentStep(1)
					setApplyError(null)
				}
				setShow(true)
				setClear(false)
			},
		}),
		[clear, setupWizard]
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
	switch (wizardMode) {
		case 'import_page':
			break
		case 'import_full':
			break
		case 'reset':
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
				case 4:
					//modalBody = <ResetFinishStep error={applyError} />
					break
				default:
			}
			break
		default:
	}

	return (
		<CModal show={show} onClose={doClose} className={'wizard'}>
			<CForm className={'edit-button-panel'}>
				<CModalHeader>
					<h2>
						<img src="/img/brand/icon.png" height="30" alt="logo" />
						{wizardTitle}
					</h2>
				</CModalHeader>
				<CModalBody>{modalBody}</CModalBody>
				<CModalFooter>
					{!applyStep ||
						(currentStep <= applyStep && (
							<CButton color="secondary" onClick={doClose}>
								Cancel
							</CButton>
						))}
					<CButton color="secondary" disabled={currentStep === 1} onClick={doPrevStep}>
						Previous
					</CButton>
					{nextButton}
				</CModalFooter>
			</CForm>
		</CModal>
	)
})
