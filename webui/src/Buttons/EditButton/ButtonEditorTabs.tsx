import { faClone, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { GetStepIds } from '@companion-app/shared/Controls.js'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { TabArea } from '~/Components/TabArea.js'
import { TextInputField } from '~/Components/TextInputField.js'
import useElementClientSize from '~/Hooks/useElementClientSize.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useControlActionStepsAndSetsService } from '~/Services/Controls/ControlActionStepsAndSetsService.js'
import type { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'
import { ControlActionStepTab } from './ControlActionStepTab.js'

export interface ButtonEditorExtraTabs {
	id: string
	name: string
	position: 'start' | 'end'
}

interface ButtonEditorTabsProps {
	controlId: string
	location: ControlLocation
	steps: NormalButtonSteps
	disabledSetStep: boolean
	runtimeProps: Record<string, any>
	rotaryActions: boolean
	localVariablesStore: LocalVariablesStore
	extraTabs?: ButtonEditorExtraTabs[]
	children?: (currentTab: string) => React.ReactNode
}
export function ButtonEditorTabs({
	controlId,
	location,
	steps,
	disabledSetStep,
	runtimeProps,
	rotaryActions,
	localVariablesStore,
	extraTabs,
	children,
}: ButtonEditorTabsProps): React.JSX.Element {
	const confirmRef = useRef<GenericConfirmModalRef>(null)
	const [tabBarRef, tabBarSize] = useElementClientSize<HTMLDivElement>()

	const stepKeys = useMemo(() => GetStepIds(steps), [steps])

	const tabKeys = useMemo(() => {
		const tabKeys: string[] = [...stepKeys.map((s) => `step:${s}`)]

		if (extraTabs) {
			tabKeys.unshift(...extraTabs.filter((t) => t.position === 'start').map((t) => t.id))
			tabKeys.push(...extraTabs.filter((t) => t.position === 'end').map((t) => t.id))
		}

		return tabKeys
	}, [stepKeys, extraTabs])

	const defaultStep = stepKeys[0] ? `step:${stepKeys[0]}` : (tabKeys[0] ?? '')
	const [selectedStep, setSelectedStep] = useLocalStorage('buttonEditor.activeTab', defaultStep)
	useEffect(() => {
		if (!tabKeys.includes(selectedStep)) {
			setSelectedStep(stepKeys[0] ? `step:${stepKeys[0]}` : (tabKeys[0] ?? ''))
		}
	}, [tabKeys, selectedStep, stepKeys, setSelectedStep])

	const service = useControlActionStepsAndSetsService(controlId, confirmRef, setSelectedStep)

	const selectedIndex = stepKeys.findIndex((k) => `step:${k}` === selectedStep)
	const selectedKey = selectedIndex >= 0 && stepKeys[selectedIndex]
	const selectedStepProps = selectedKey ? steps[selectedKey] : undefined

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />

			<div ref={tabBarRef} className="sticky-heading pt-0">
				<TabArea.Root value={selectedStep} onValueChange={setSelectedStep}>
					<TabArea.List>
						{extraTabs?.map(
							(tab) =>
								tab.position === 'start' && (
									<TabArea.Tab key={tab.id} className="nav-steps-special" value={tab.id} title={tab.name}>
										{tab.name}
									</TabArea.Tab>
								)
						)}

						{stepKeys.map((stepId, i) => (
							<ActionSetTab
								key={stepId}
								controlId={controlId}
								stepId={stepId}
								stepIndex={i}
								stepOptions={steps[stepId]?.options}
								moreThanOneStep={stepKeys.length > 1}
								isCurrent={runtimeProps.current_step_id === stepId}
							/>
						))}

						{extraTabs?.map(
							(tab) =>
								tab.position === 'end' && (
									<TabArea.Tab key={tab.id} className="nav-steps-special" value={tab.id} title={tab.name}>
										{tab.name}
									</TabArea.Tab>
								)
						)}

						{stepKeys.length === 1 && (
							<div className="tab-end-area align-self-center">
								<Button title="Add step" size="sm" onClick={service.appendStep}>
									<FontAwesomeIcon icon={faPlus} />
								</Button>
								<Button title="Duplicate step" size="sm" onClick={() => service.duplicateStep(stepKeys[0])}>
									<FontAwesomeIcon icon={faClone} />
								</Button>
							</div>
						)}
					</TabArea.List>
				</TabArea.Root>
			</div>

			<div className="edit-sticky-body" style={{ '--tab-bar-height': `${tabBarSize.height}px` } as React.CSSProperties}>
				{children && children(selectedStep)}

				{selectedKey && selectedStepProps && (
					<ControlActionStepTab
						service={service}
						controlId={controlId}
						location={location}
						runtimeProps={runtimeProps}
						rotaryActions={rotaryActions}
						stepKeys={stepKeys}
						selectedIndex={selectedIndex}
						selectedKey={selectedKey}
						selectedStepProps={selectedStepProps}
						localVariablesStore={localVariablesStore}
						disabledSetStep={disabledSetStep}
					/>
				)}
			</div>
		</>
	)
}

interface ActionSetTabProps {
	controlId: string
	stepId: string
	stepIndex: number
	stepOptions: ActionStepOptions | undefined
	// if there's more than one step, we need to show the current step
	moreThanOneStep: boolean
	// the current step is the one that is currently being executed
	isCurrent: boolean
}
function ActionSetTab({
	controlId,
	stepId,
	stepIndex,
	stepOptions,
	moreThanOneStep,
	isCurrent,
}: Readonly<ActionSetTabProps>) {
	let linkClassname: string | undefined = undefined

	const name = stepOptions?.name
	const displayText = name
		? name + ` (${stepIndex + 1})`
		: stepIndex === 0
			? 'Step ' + (stepIndex + 1)
			: String(stepIndex + 1)

	if (moreThanOneStep) {
		if (isCurrent) linkClassname = 'highlight-current'
	}

	const renameStepMutation = useMutationExt(trpc.controls.steps.rename.mutationOptions())

	const renameStep = useCallback(
		(newName: string) => {
			renameStepMutation.mutateAsync({ controlId, stepId, newName }).catch((e) => {
				console.error('Failed to rename step:', e)
			})
		},
		[renameStepMutation, controlId, stepId]
	)

	const [showInputField, setShowInputField] = useState(false)

	const showField = useCallback(() => setShowInputField(true), [setShowInputField])
	const hideField = useCallback(() => setShowInputField(false), [setShowInputField])
	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLElement>) => {
			if (e.key === 'Enter' || e.key === 'Escape') {
				setShowInputField(false)
			}
		},
		[setShowInputField]
	)

	return (
		<TabArea.Tab
			className={classNames('nav-steps-special', linkClassname)}
			value={`step:${stepId}`}
			title={displayText}
			onDoubleClick={showField}
		>
			{showInputField ? (
				<TextInputField value={name ?? ''} setValue={renameStep} onBlur={hideField} onKeyDown={onKeyDown} />
			) : (
				displayText
			)}
		</TabArea.Tab>
	)
}
