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
import {
	WIZARD_CURRENT_VERSION,
	WIZARD_VERSION_2_2,
	WIZARD_VERSION_3_0,
	WIZARD_VERSION_3_4,
	WIZARD_VERSION_4_2,
	WIZARD_VERSION_4_3,
	WIZARD_VERSION_5_0,
} from './Constants.js'
import { FinishStep } from './FinishStep.js'
import { WIZARD_CONFIG_STEPS } from './Steps.js'
import { WizardStepper, type WizardStepperItem } from './WizardStepper.js'

// Dev-only: the versions selectable in the "preview from version" control
const DEV_VERSION_OPTIONS: { label: string; value: number }[] = [
	{ label: 'Fresh install', value: 0 },
	{ label: '2.2', value: WIZARD_VERSION_2_2 },
	{ label: '3.0', value: WIZARD_VERSION_3_0 },
	{ label: '3.4', value: WIZARD_VERSION_3_4 },
	{ label: '4.2', value: WIZARD_VERSION_4_2 },
	{ label: '4.3', value: WIZARD_VERSION_4_3 },
	{ label: '5.0', value: WIZARD_VERSION_5_0 },
]

export function WizardModal(): React.JSX.Element {
	const { showWizardEvent, userConfig, wizardActive } = useContext(RootAppStoreContext)

	const [currentStep, setCurrentStep] = useState(0)
	const [startConfig, setStartConfig] = useState<UserConfigModel | null>(null)
	const [oldConfig, setOldConfig] = useState<UserConfigModel | null>(null)
	const [newConfig, setNewConfig] = useState<UserConfigModel | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [clear, setClear] = useState(true)
	const [reviewAll, setReviewAll] = useState(false)
	// Dev-only: override the "from" version to preview the upgrade experience (see the dev control below)
	const [devFromVersion, setDevFromVersion] = useState<number | undefined>(undefined)

	// The configurable steps available this session. Availability is fixed at the config captured when the
	// wizard opened, so steps don't appear/disappear as the user edits values mid-flow.
	const availableSteps = useMemo(
		() => (startConfig ? WIZARD_CONFIG_STEPS.filter((s) => !s.isAvailable || s.isAvailable(startConfig)) : []),
		[startConfig]
	)

	// The version the user last completed the wizard at; 0 for a fresh install. Determines the short upgrade flow.
	const prevVersion = devFromVersion ?? startConfig?.setup_wizard ?? 0
	const isUpgrade = prevVersion > 0

	const newSteps = useMemo(
		() => availableSteps.filter((s) => s.revisedInVersion > prevVersion),
		[availableSteps, prevVersion]
	)

	// Upgrading users see only the steps that changed since they last ran the wizard. Fresh installs, and anyone
	// who chooses "review all", see every step. If nothing is new (e.g. dev preview of the current version), fall
	// back to the full flow rather than an empty wizard.
	const showAllSteps = reviewAll || newSteps.length === 0
	const configurableSteps = showAllSteps ? availableSteps : newSteps

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
				setReviewAll(false)
			}
			setShow(true)
			setClear(false)
		}

		showWizardEvent.addEventListener('show', show)
		return () => {
			showWizardEvent.removeEventListener('show', show)
		}
	}, [showWizardEvent, clear, getConfig])

	// Let the rest of the app know the wizard is open, so the What's New modal can wait its turn
	useEffect(() => {
		wizardActive.set(show)
	}, [show, wizardActive])

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

	// One stepper entry per configurable step, plus the review (Apply) step. When reviewing everything as an
	// upgrader, badge the steps that are actually new/changed since the previous version.
	const stepperItems: WizardStepperItem[] = [
		...configurableSteps.map((step, i) => ({
			index: i + 1,
			title: step.title,
			isNew: isUpgrade && step.revisedInVersion > prevVersion,
		})),
		{ index: applyStepIndex, title: 'Review' },
	]
	const showStepper = currentStep !== finishStepIndex

	// The configurable step (if any) active for the current index
	const activeConfigStep =
		currentStep >= 1 && currentStep <= configurableSteps.length ? configurableSteps[currentStep - 1] : undefined

	return (
		<>
			{import.meta.env.DEV && show && (
				<div className="wizard-dev-controls">
					<label>
						🛠 Preview from version:{' '}
						<select
							value={devFromVersion ?? ''}
							onChange={(e) => {
								setDevFromVersion(e.target.value === '' ? undefined : Number(e.target.value))
								setReviewAll(false)
								setCurrentStep(0)
							}}
						>
							<option value="">Use real config ({startConfig?.setup_wizard ?? '?'})</option>
							{DEV_VERSION_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label} ({opt.value})
								</option>
							))}
						</select>
					</label>
				</div>
			)}
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
										<BeginStep
											prevVersion={prevVersion}
											newStepTitles={newSteps.map((step) => step.title)}
											showAll={showAllSteps}
											onReviewAll={() => setReviewAll(true)}
										/>
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
		</>
	)
}
