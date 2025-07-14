import { GetStepIds } from '@companion-app/shared/Controls.js'
import { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { CNav, CNavItem, CNavLink, CButton } from '@coreui/react'
import { faPlus, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { GenericConfirmModalRef, GenericConfirmModal } from '~/Components/GenericConfirmModal.js'
import { useControlActionStepsAndSetsService } from '~/Services/Controls/ControlActionStepsAndSetsService.js'
import { ControlActionStepTab } from './ControlActionStepTab.js'
import { trpc, useMutationExt } from '~/TRPC.js'

export interface ButtonEditorExtraTabs {
	id: string
	name: string
}

interface ButtonEditorTabsProps {
	controlId: string
	location: ControlLocation
	steps: NormalButtonSteps
	disabledSetStep: boolean
	runtimeProps: Record<string, any>
	rotaryActions: boolean
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
	extraTabs,
	children,
}: ButtonEditorTabsProps): React.JSX.Element {
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const stepKeys = useMemo(() => GetStepIds(steps), [steps])

	const tabKeys = useMemo(() => {
		const tabKeys: string[] = [...stepKeys.map((s) => `step:${s}`)]

		if (extraTabs) {
			tabKeys.push(...extraTabs.map((t) => t.id))
		}

		return tabKeys
	}, [stepKeys, extraTabs])

	const [selectedStep, setSelectedStep] = useState(tabKeys[0] ?? '')
	useEffect(() => {
		if (!tabKeys.includes(selectedStep)) {
			setSelectedStep(tabKeys[0])
		}
	}, [tabKeys, selectedStep])

	const service = useControlActionStepsAndSetsService(controlId, confirmRef, setSelectedStep)

	const selectedIndex = stepKeys.findIndex((k) => `step:${k}` === selectedStep)
	const selectedKey = selectedIndex >= 0 && stepKeys[selectedIndex]
	const selectedStepProps = selectedKey ? steps[selectedKey] : undefined

	return (
		<div key="button">
			<GenericConfirmModal ref={confirmRef} />

			<div className={'row-heading'}>
				<CNav variant="tabs">
					{stepKeys.map((stepId, i) => (
						<ActionSetTab
							key={stepId}
							controlId={controlId}
							stepId={stepId}
							stepIndex={i}
							stepOptions={steps[stepId]?.options}
							moreThanOneStep={stepKeys.length > 1}
							isCurrent={runtimeProps.current_step_id === stepId}
							isActiveAndCurrent={
								stepId.toString() === selectedIndex.toString() && runtimeProps.current_step_id === stepId
							}
							active={selectedStep === `step:${stepId}`}
							onClick={() => setSelectedStep(`step:${stepId}`)}
						/>
					))}

					{extraTabs?.map((tab) => (
						<CNavItem key={tab.id} className="nav-steps-special">
							<CNavLink active={selectedStep === tab.id} onClick={() => setSelectedStep(tab.id)}>
								{tab.name}
							</CNavLink>
						</CNavItem>
					))}

					{stepKeys.length === 1 && (
						<div className="nav-last">
							<CButton title="Add step" size="sm" onClick={service.appendStep}>
								<FontAwesomeIcon icon={faPlus} />
							</CButton>
							<CButton title="Duplicate step" size="sm" onClick={() => service.duplicateStep(stepKeys[0])}>
								<FontAwesomeIcon icon={faCopy} />
							</CButton>
						</div>
					)}
				</CNav>
			</div>

			<div className="edit-sticky-body">
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
						disabledSetStep={disabledSetStep}
					/>
				)}
			</div>
		</div>
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
	// both selected and the current step
	isActiveAndCurrent: boolean
	active: boolean
	onClick: () => void
}
function ActionSetTab({
	controlId,
	stepId,
	stepIndex,
	stepOptions,
	moreThanOneStep,
	isCurrent,
	isActiveAndCurrent,
	active,
	onClick,
}: Readonly<ActionSetTabProps>) {
	let linkClassname: string | undefined = undefined

	const name = stepOptions?.name
	const displayText = name ? name + ` (${stepIndex + 1})` : stepIndex === 0 ? 'Step ' + (stepIndex + 1) : stepIndex + 1

	if (moreThanOneStep) {
		if (isActiveAndCurrent) linkClassname = 'selected-and-active'
		else if (isCurrent) linkClassname = 'only-current'
	}

	const renameStepMutation = useMutationExt(trpc.controls.steps.rename.mutationOptions())

	const renameStep = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			renameStepMutation.mutateAsync({ controlId, stepId, newName: e.target.value }).catch((e) => {
				console.error('Failed to rename step:', e)
			})
		},
		[renameStepMutation, controlId, stepId]
	)

	const [showInputField, setShowInputField] = useState(false)

	const showField = useCallback(() => setShowInputField(true), [setShowInputField])
	const hideField = useCallback(() => setShowInputField(false), [setShowInputField])
	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter' || e.key === 'Escape') {
				setShowInputField(false)
			}
		},
		[setShowInputField]
	)

	return (
		<CNavItem className="nav-steps-special">
			{showInputField ? (
				<CNavLink className={linkClassname}>
					<input
						type="text"
						value={name}
						onChange={renameStep}
						onKeyDown={onKeyDown}
						onBlur={hideField}
						autoFocus
					></input>
				</CNavLink>
			) : (
				<CNavLink onDoubleClick={showField} active={active} onClick={onClick} className={linkClassname}>
					{displayText}
				</CNavLink>
			)}
		</CNavItem>
	)
}
