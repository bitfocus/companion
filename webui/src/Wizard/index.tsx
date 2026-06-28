import { reaction, toJS } from 'mobx'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { Form } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal.js'
import { StepSelector, type StepSelectorItem } from '~/Components/StepSelector.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ApplyStep, getWizardChanges } from './ApplyStep.js'
import { BeginStep } from './BeginStep.js'
import { WIZARD_CURRENT_VERSION, WIZARD_VERSIONS } from './Constants.js'
import { FinishStep } from './FinishStep.js'
import { WIZARD_CONFIG_STEPS } from './Steps.js'

// Dev-only: the versions selectable in the "preview from version" control, plus a fresh-install option
const DEV_VERSION_OPTIONS: { label: string; value: number }[] = [
	{ label: 'Fresh install', value: 0 },
	...WIZARD_VERSIONS,
]

export const WizardModal = observer(function WizardModal(): React.JSX.Element {
	const { userConfig, wizardOpen } = useContext(RootAppStoreContext)

	const [currentStep, setCurrentStep] = useState(0)
	const [startConfig, setStartConfig] = useState<UserConfigModel | null>(null)
	const [oldConfig, setOldConfig] = useState<UserConfigModel | null>(null)
	const [newConfig, setNewConfig] = useState<UserConfigModel | null>(null)
	const [error, setError] = useState<string | null>(null)
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

	// When there's nothing to apply, the review step is pointless, so fold the finish step into it: show the
	// finish content there and turn the Apply button into Finish (skipping the separate finish step).
	const reviewChanges = useMemo(
		() => (oldConfig && newConfig ? getWizardChanges(oldConfig, newConfig) : []),
		[oldConfig, newConfig]
	)
	const hasReviewChanges = reviewChanges.length > 0

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

	const show = wizardOpen.get()
	const doClose = useCallback(() => wizardOpen.set(false), [wizardOpen])

	const setConfigKeyMutation = useMutationExt(trpc.userConfig.setConfigKey.mutationOptions())
	const setConfigKeysMutation = useMutationExt(trpc.userConfig.setConfigKeys.mutationOptions())

	const onOpenChangeComplete = useCallback(
		(open: boolean) => {
			if (!open) {
				setConfigKeyMutation.mutate({ key: 'setup_wizard', value: WIZARD_CURRENT_VERSION })
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

	// Capture a fresh config snapshot and reset to the first step each time the wizard is opened
	useEffect(() => {
		return reaction(
			() => wizardOpen.get(),
			(open) => {
				if (open) {
					getConfig()
					setCurrentStep(0)
					setReviewAll(false)
				}
			}
		)
	}, [wizardOpen, getConfig])

	const buttonRef = useRef<HTMLButtonElement>(null)

	let nextButton
	switch (currentStep) {
		case applyStepIndex:
			nextButton = hasReviewChanges ? (
				<Button ref={buttonRef} color="primary" onClick={doSave}>
					Apply
				</Button>
			) : (
				<Button ref={buttonRef} color="primary" onClick={doClose}>
					Finish
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
	const stepperItems: StepSelectorItem[] = [
		...configurableSteps.map((step, i) => ({
			index: i + 1,
			title: step.title,
			isNew: isUpgrade && step.revisedInVersion > prevVersion,
		})),
		{ index: applyStepIndex, title: 'Review' },
	]
	// Hide the stepper only on the dedicated finish screen; the merged review/finish step keeps it
	const showStepper = currentStep !== finishStepIndex

	// The configurable step (if any) active for the current index
	const activeConfigStep =
		currentStep >= 1 && currentStep <= configurableSteps.length ? configurableSteps[currentStep - 1] : undefined

	// On the post-applied finish step, "Previous" would step back over already-applied changes, so offer a
	// Restart instead which returns to the beginning of the wizard.
	const previousButton =
		currentStep === finishStepIndex ? (
			<Button color="secondary" onClick={() => doJumpToStep(beginStepIndex)}>
				Start over
			</Button>
		) : (
			<Button color="secondary" disabled={currentStep === beginStepIndex} onClick={doPrevStep}>
				Previous
			</Button>
		)

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
			<Modal.Root
				open={show}
				onOpenChange={(open) => wizardOpen.set(open)}
				onOpenChangeComplete={onOpenChangeComplete}
				disableDismiss
			>
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
								<StepSelector items={stepperItems} currentIndex={currentStep} onJump={doJumpToStep} />
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
									{currentStep === applyStepIndex && newConfig && oldConfig && startConfig && !error ? (
										hasReviewChanges ? (
											<ApplyStep oldConfig={oldConfig} newConfig={newConfig} />
										) : (
											<FinishStep oldConfig={startConfig} newConfig={newConfig} />
										)
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
									{previousButton}
									{nextButton}
								</Modal.Footer>
							</Form>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		</>
	)
})
