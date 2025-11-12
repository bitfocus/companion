import { GetStepIds } from '@companion-app/shared/Controls.js'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { CNav, CNavItem, CNavLink, CButton } from '@coreui/react'
import { faPlus, faClone } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { useControlActionStepsAndSetsService } from '~/Services/Controls/ControlActionStepsAndSetsService.js'
import { ControlActionStepTab } from './ControlActionStepTab.js'
import type { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

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

	const stepKeys = useMemo(() => GetStepIds(steps), [steps])

	const tabKeys = useMemo(() => {
		const tabKeys: string[] = [...stepKeys.map((s) => `step:${s}`)]

		if (extraTabs) {
			for (const tab of extraTabs) {
				if (tab.position === 'start') {
					tabKeys.unshift(tab.id)
				} else {
					tabKeys.push(tab.id)
				}
			}
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
		<>
			<GenericConfirmModal ref={confirmRef} />

			<div className={'row-heading'}>
				<CNav variant="tabs">
					{extraTabs?.map(
						(tab) =>
							tab.position === 'start' && (
								<CNavItem key={tab.id} className="nav-steps-special">
									<CNavLink active={selectedStep === tab.id} onClick={() => setSelectedStep(tab.id)}>
										{tab.name}
									</CNavLink>
								</CNavItem>
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
							isActiveAndCurrent={
								stepId.toString() === selectedIndex.toString() && runtimeProps.current_step_id === stepId
							}
							active={selectedStep === `step:${stepId}`}
							onClick={() => setSelectedStep(`step:${stepId}`)}
						/>
					))}

					{extraTabs?.map(
						(tab) =>
							tab.position === 'end' && (
								<CNavItem key={tab.id} className="nav-steps-special">
									<CNavLink active={selectedStep === tab.id} onClick={() => setSelectedStep(tab.id)}>
										{tab.name}
									</CNavLink>
								</CNavItem>
							)
					)}

					{stepKeys.length === 1 && (
						<div className="nav-last align-self-center">
							<CButton title="Add step" size="sm" onClick={service.appendStep}>
								<FontAwesomeIcon icon={faPlus} />
							</CButton>
							<CButton title="Duplicate step" size="sm" onClick={() => service.duplicateStep(stepKeys[0])}>
								<FontAwesomeIcon icon={faClone} />
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
