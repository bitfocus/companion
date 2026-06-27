import { toJS } from 'mobx'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { Form } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ApplyStep } from './ApplyStep.js'
import { BeginStep } from './BeginStep.js'
import { WIZARD_CURRENT_VERSION } from './Constants.js'
import { FinishStep } from './FinishStep.js'
import { WIZARD_CONFIG_STEPS } from './Steps.js'
import { WizardStepper, type WizardStepperItem } from './WizardStepper.js'

export function WizardModal(): React.JSX.Element {
	const { showWizardEvent, userConfig } = useContext(RootAppStoreContext)

	const [currentStep, setCurrentStep] = useState(0)
	const [startConfig, setStartConfig] = useState<UserConfigModel | null>(null)
	const [oldConfig, setOldConfig] = useState<UserConfigModel | null>(null)
	const [newConfig, setNewConfig] = useState<UserConfigModel | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [clear, setClear] = useState(true)

	// The configurable steps available this session. Availability is fixed at the config captured when the
	// wizard opened, so steps don't appear/disappear as the user edits values mid-flow.
	const configurableSteps = useMemo(
		() => (startConfig ? WIZARD_CONFIG_STEPS.filter((s) => !s.isAvailable || s.isAvailable(startConfig)) : []),
		[startConfig]
	)

	// The wizard is a flat sequence: [Begin, ...configurableSteps, Apply, Finish]. `currentStep` indexes into it.
	const beginStepIndex = 0
	const applyStepIndex = configurableSteps.length + 1
	const finishStepIndex = configurableSteps.length + 2

	const getConfig = useCallback(() => {
		if (!userConfig.properties) {
			setError('Config is not loaded')
			return
		}

		// Copy the config from the main store
		const config = toJS(userConfig.properties)

		setError(null)
		setStartConfig(config)
		setOldConfig(config)
		setNewConfig(config)
	}, [userConfig])

	const [show, setShow] = useState(false)
	const doClose = useCallback(() => setShow(false), [])

	const setConfigKeyMutation = useMutationExt(trpc.userConfig.setConfigKey.mutationOptions())
	const setConfigKeysMutation = useMutationExt(trpc.userConfig.setConfigKeys.mutationOptions())

	const onOpenChangeComplete = useCallback(
		(open: boolean) => {
			if (!open) {
				setConfigKeyMutation.mutate({ key: 'setup_wizard', value: WIZARD_CURRENT_VERSION })
				setClear(true)
			}
		},
		[setConfigKeyMutation]
	)

	const doNextStep = useCallback(() => {
		setCurrentStep((currentStep) => Math.min(currentStep + 1, finishStepIndex))
	}, [finishStepIndex])

	const doPrevStep = useCallback(() => {
		setCurrentStep((currentStep) => Math.max(currentStep - 1, beginStepIndex))
	}, [beginStepIndex])

	const doJumpToStep = useCallback((index: number) => setCurrentStep(index), [])

	const doSave = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()

			if (!oldConfig || !newConfig) return

			const saveConfig: Partial<UserConfigModel> = {}

			for (const id0 in oldConfig) {
				const id = id0 as keyof UserConfigModel
				if (oldConfig[id] !== newConfig[id]) {
					saveConfig[id] = newConfig[id] as any
				}
			}

			setConfigKeysMutation.mutate({ values: saveConfig })

			setOldConfig(newConfig)

			doNextStep()
		},
		[setConfigKeysMutation, newConfig, oldConfig, doNextStep]
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
				setCurrentStep(0)
			}
			setShow(true)
			setClear(false)
		}

		showWizardEvent.addEventListener('show', show)
		return () => {
			showWizardEvent.removeEventListener('show', show)
		}
	}, [showWizardEvent, clear, getConfig])

	const buttonRef = useRef<HTMLButtonElement>(null)

	let nextButton
	switch (currentStep) {
		case applyStepIndex:
			nextButton = (
				<Button ref={buttonRef} color="primary" onClick={doSave}>
					Apply
				</Button>
			)
			break
		case finishStepIndex:
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

	// One stepper entry per configurable step, plus the review (Apply) step
	const stepperItems: WizardStepperItem[] = [
		...configurableSteps.map((step, i) => ({ index: i + 1, title: step.title })),
		{ index: applyStepIndex, title: 'Review' },
	]
	const showStepper = currentStep !== finishStepIndex

	// The configurable step (if any) active for the current index
	const activeConfigStep =
		currentStep >= 1 && currentStep <= configurableSteps.length ? configurableSteps[currentStep - 1] : undefined

	return (
		<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup initialFocus={buttonRef} size="lg" scrollable className="modal-wizard">
						<Modal.Header closeButton>
							<Modal.Title>
								<img src={makeAbsolutePath('/img/icons/48x48.png')} height="30" alt="logo" className="me-2" />
								Welcome to Companion
							</Modal.Title>
						</Modal.Header>
						{showStepper && stepperItems.length > 0 && (
							<WizardStepper items={stepperItems} currentIndex={currentStep} onJump={doJumpToStep} />
						)}
						<Form onSubmit={doSave} className="flex-form">
							<Modal.Body>
								{error ? <StaticAlert color="danger">{error}</StaticAlert> : ''}
								{currentStep === beginStepIndex && newConfig && !error ? (
									<BeginStep stepTitles={configurableSteps.map((step) => step.title)} />
								) : (
									''
								)}
								{activeConfigStep && newConfig && !error
									? activeConfigStep.render({ config: newConfig, setValue })
									: ''}
								{currentStep === applyStepIndex && newConfig && oldConfig && !error ? (
									<ApplyStep oldConfig={oldConfig} newConfig={newConfig} />
								) : (
									''
								)}
								{currentStep === finishStepIndex && newConfig && startConfig && !error ? (
									<FinishStep oldConfig={startConfig} newConfig={newConfig} />
								) : (
									''
								)}
							</Modal.Body>
							<Modal.Footer>
								{currentStep <= applyStepIndex && <Modal.Close>Cancel</Modal.Close>}
								<Button color="secondary" disabled={currentStep === beginStepIndex} onClick={doPrevStep}>
									Previous
								</Button>
								{nextButton}
							</Modal.Footer>
						</Form>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
