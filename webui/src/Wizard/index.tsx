import React, { FormEvent, useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CButton, CForm, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { BeginStep } from './BeginStep.js'
import { SurfacesStep } from './SurfacesStep.js'
import { GridStep } from './GridStep.js'
import { ServicesStep } from './ServicesStep.js'
import { PasswordStep } from './PasswordStep.js'
import { ApplyStep } from './ApplyStep.js'
import { FinishStep } from './FinishStep.js'
import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export const WIZARD_VERSION_2_2 = 22 // 2.2
export const WIZARD_VERSION_3_0 = 30 // 3.0
export const WIZARD_VERSION_3_4 = 34 // 3.0

export const WIZARD_CURRENT_VERSION = WIZARD_VERSION_3_4

export function WizardModal() {
	const { socket, showWizardEvent } = useContext(RootAppStoreContext)

	const [currentStep, setCurrentStep] = useState(1)
	const [maxSteps, setMaxSteps] = useState(7)
	const [applyStep, setApplyStep] = useState(6)
	const [allowGridStep, setAllowGridStep] = useState(1)
	const [startConfig, setStartConfig] = useState<UserConfigModel | null>(null)
	const [oldConfig, setOldConfig] = useState<UserConfigModel | null>(null)
	const [newConfig, setNewConfig] = useState<UserConfigModel | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [clear, setClear] = useState(true)

	const getConfig = useCallback(() => {
		socket
			.emitPromise('userconfig:get-all', [])
			.then((config) => {
				setStartConfig(config)
				setOldConfig(config)
				setNewConfig(config)

				if (config.gridSize.minColumn === 0 && config.gridSize.minRow === 0) {
					setMaxSteps(7)
					setApplyStep(6)
					setAllowGridStep(1)
				} else {
					setMaxSteps(6)
					setApplyStep(5)
					setAllowGridStep(0)
				}
			})
			.catch((e) => {
				setError('Could not load configuration for wizard.  Please close and try again.')
				console.error('Failed to load user config', e)
			})
	}, [socket])

	const [show, setShow] = useState(false)

	const doClose = useCallback(() => {
		socket.emit('set_userconfig_key', 'setup_wizard', WIZARD_CURRENT_VERSION)
		setShow(false)
		setClear(true)
	}, [socket])

	const doNextStep = useCallback(() => {
		setCurrentStep((currentStep) => {
			// Make sure step is set to something reasonable
			if (currentStep >= maxSteps - 1) {
				return maxSteps
			} else {
				return currentStep + 1
			}
		})
	}, [maxSteps])

	const doPrevStep = useCallback(() => {
		setCurrentStep((currentStep) => {
			if (currentStep <= 1) {
				return 1
			} else {
				return currentStep - 1
			}
		})
	}, [])

	const doSave = useCallback(
		(e: FormEvent) => {
			e.preventDefault()

			if (!oldConfig || !newConfig) return

			let saveConfig: Partial<UserConfigModel> = {}

			for (const id0 in oldConfig) {
				const id = id0 as keyof UserConfigModel
				if (oldConfig[id] !== newConfig[id]) {
					saveConfig[id] = newConfig[id] as any
				}
			}

			socket.emit('set_userconfig_keys', saveConfig)

			setOldConfig(newConfig)

			doNextStep()
		},
		[socket, newConfig, oldConfig, doNextStep]
	)

	const setValue = (key: keyof UserConfigModel, value: any) => {
		setNewConfig(
			(oldState) =>
				oldState && {
					...oldState,
					[key]: value,
				}
		)
	}

	useEffect(() => {
		const show = () => {
			if (clear) {
				getConfig()
				setCurrentStep(1)
			}
			setShow(true)
			setClear(false)
		}

		showWizardEvent.addEventListener('show', show)
		return () => {
			showWizardEvent.removeEventListener('show', show)
		}
	}, [showWizardEvent])

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

	return (
		<CModal visible={show} onClose={doClose} className={'wizard'}>
			<CForm onSubmit={doSave} className={'flex-form'}>
				<CModalHeader>
					<h2>
						<img src="/img/icons/48x48.png" height="30" alt="logo" />
						Welcome to Companion
					</h2>
				</CModalHeader>
				<CModalBody>
					{error ? <CAlert color="danger">{error}</CAlert> : ''}
					{currentStep === 1 && newConfig && !error ? <BeginStep allowGrid={allowGridStep} /> : ''}
					{currentStep === 2 && newConfig && !error ? <SurfacesStep config={newConfig} setValue={setValue} /> : ''}
					{currentStep === 3 && allowGridStep === 1 && newConfig && !error ? (
						<GridStep
							rows={newConfig.gridSize.maxRow + 1}
							columns={newConfig.gridSize.maxColumn + 1}
							setValue={setValue}
						/>
					) : (
						''
					)}
					{currentStep === 3 + allowGridStep && newConfig && !error ? (
						<ServicesStep config={newConfig} setValue={setValue} />
					) : (
						''
					)}
					{currentStep === 4 + allowGridStep && newConfig && !error ? (
						<PasswordStep config={newConfig} setValue={setValue} />
					) : (
						''
					)}
					{currentStep === applyStep && newConfig && oldConfig && !error ? (
						<ApplyStep oldConfig={oldConfig} newConfig={newConfig} />
					) : (
						''
					)}
					{currentStep === maxSteps && newConfig && startConfig && !error ? (
						<FinishStep oldConfig={startConfig} newConfig={newConfig} />
					) : (
						''
					)}
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
}
