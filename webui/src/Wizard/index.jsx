import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { CAlert, CButton, CForm, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { StaticContext, socketEmit } from '../util'
import { BeginStep } from './BeginStep'
import { SurfacesStep } from './SurfacesStep'
import { ServicesStep } from './ServicesStep'
import { PasswordStep } from './PasswordStep'
import { ApplyStep } from './ApplyStep'
import { FinishStep } from './FinishStep'

export const WizardModal = forwardRef(function WizardModal(_props, ref) {
	const context = useContext(StaticContext)
	const [currentStep, setCurrentStep] = useState(1)
	const maxSteps = 6 // can use useState in the future if the number of steps needs to be dynamic
	const applyStep = 5 // can use useState in the future if the number of steps needs to be dynamic
	const [startConfig, setStartConfig] = useState(null)
	const [oldConfig, setOldConfig] = useState(null)
	const [newConfig, setNewConfig] = useState(null)
	const [error, setError] = useState(null)
	const [clear, setClear] = useState(true)

	const getConfig = useCallback(() => {
		socketEmit(context.socket, 'get_userconfig_all', [])
			.then(([config]) => {
				setStartConfig(config)
				setOldConfig(config)
				setNewConfig(config)
			})
			.catch((e) => {
				setError('Could not load configuration for wizard.  Please close and try again.')
				console.error('Failed to load user config', e)
			})
	}, [context.socket])

	const [show, setShow] = useState(false)

	const doClose = useCallback(() => {
		context.socket.emit('set_userconfig_key', 'setup_wizard', context.currentVersion)
		setShow(false)
		setClear(true)
	}, [context])

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

			let saveConfig = {}

			for (const id in oldConfig) {
				if (oldConfig[id] !== newConfig[id]) {
					saveConfig[id] = newConfig[id]
				}
			}

			context.socket.emit('set_userconfig_keys', saveConfig)

			setOldConfig(newConfig)

			doNextStep()
		},
		[context.socket, newConfig, oldConfig, doNextStep]
	)

	const setValue = (key, value) => {
		setNewConfig((oldState) => ({
			...oldState,
			[key]: value,
		}))
	}

	useImperativeHandle(
		ref,
		() => ({
			show() {
				if (clear) {
					getConfig()
					setCurrentStep(1)
				}
				setShow(true)
				setClear(false)
			},
		}),
		[getConfig, clear]
	)

	let nextButton
	switch (currentStep) {
		case 5:
			nextButton = (
				<CButton color="primary" onClick={doSave}>
					Apply
				</CButton>
			)
			break
		case 6:
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

	return (
		<CModal show={show} onClose={doClose} className={'wizard'}>
			<CForm onSubmit={doSave} className={'edit-button-panel'}>
				<CModalHeader>
					<h2>
						<img src="/img/brand/icon.png" height="30" alt="logo" />
						Welcome to Companion
					</h2>
				</CModalHeader>
				<CModalBody>
					{error ? <CAlert color="danger">{error}</CAlert> : ''}
					{currentStep === 1 && !error ? <BeginStep /> : ''}
					{currentStep === 2 && !error ? <SurfacesStep config={newConfig} setValue={setValue} /> : ''}
					{currentStep === 3 && !error ? <ServicesStep config={newConfig} setValue={setValue} /> : ''}
					{currentStep === 4 && !error ? <PasswordStep config={newConfig} setValue={setValue} /> : ''}
					{currentStep === 5 && !error ? <ApplyStep oldConfig={oldConfig} newConfig={newConfig} /> : ''}
					{currentStep === 6 && !error ? <FinishStep oldConfig={startConfig} newConfig={newConfig} /> : ''}
				</CModalBody>
				<CModalFooter>
					{currentStep <= applyStep && (
						<CButton color="secondary" onClick={doClose}>
							Cancel
						</CButton>
					)}
					<CButton color="secondary" disabled={currentStep === 1} onClick={doPrevStep}>
						Previous
					</CButton>
					{nextButton}
				</CModalFooter>
			</CForm>
		</CModal>
	)
})
