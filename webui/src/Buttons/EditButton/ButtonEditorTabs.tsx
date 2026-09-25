import { faChevronLeft, faChevronRight, faClone, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GetStepIds } from '@companion-app/shared/Controls.js'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { TabArea } from '~/Components/TabArea.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import useElementClientSize from '~/Hooks/useElementClientSize.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
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

export const ButtonEditorTabs = observer(function ButtonEditorTabs({
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

	// Top level tabs list: Actions + extra tabs
	const mainTabs = useMemo(() => {
		const tabs: { id: string; name: string; count?: number }[] = []

		if (extraTabs) {
			for (const t of extraTabs.filter((tab) => tab.position === 'start')) {
				tabs.push({ id: t.id, name: t.name })
			}
		}

		tabs.push({
			id: 'actions',
			name: 'Actions',
			count: stepKeys.length > 1 ? stepKeys.length : undefined,
		})

		if (extraTabs) {
			for (const t of extraTabs.filter((tab) => tab.position === 'end')) {
				tabs.push({ id: t.id, name: t.name })
			}
		}

		return tabs
	}, [stepKeys.length, extraTabs])

	const [activeMainTab, setActiveMainTab] = useLocalStorage('buttonEditor.activeMainTab', 'actions')
	const [selectedStepId, setSelectedStepId] = useLocalStorage('buttonEditor.selectedStepId', stepKeys[0] || '0')

	// Ensure selected step exists
	useEffect(() => {
		if (stepKeys.length > 0 && !stepKeys.includes(selectedStepId)) {
			setSelectedStepId(stepKeys[0] || '0')
		}
	}, [stepKeys, selectedStepId, setSelectedStepId])

	// Fallback to 'actions' if selected tab is invalid
	useEffect(() => {
		if (!mainTabs.some((t) => t.id === activeMainTab)) {
			setActiveMainTab('actions')
		}
	}, [mainTabs, activeMainTab, setActiveMainTab])

	const service = useControlActionStepsAndSetsService(controlId, confirmRef, (newStepKey) => {
		if (newStepKey.startsWith('step:')) {
			setSelectedStepId(newStepKey.slice(5))
		}
	})

	const selectedIndex = stepKeys.indexOf(selectedStepId)
	const currentStepKey = selectedIndex >= 0 ? stepKeys[selectedIndex] : stepKeys[0] || '0'
	const selectedStepProps = steps[currentStepKey]

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />

			{/* Primary Clean Navigation Tabs */}
			<div ref={tabBarRef} className="sticky-tabs button-editor-tabs-shell">
				<TabArea.Root className="button-editor-main-tabs" value={activeMainTab} onValueChange={setActiveMainTab}>
					<TabArea.List className="button-editor-main-tabs-list">
						{mainTabs.map((tab) => (
							<TabArea.Tab key={tab.id} className="button-editor-main-tab" value={tab.id} title={tab.name}>
								<div className="flex items-center gap-1.5">
									<span>{tab.name}</span>
									{tab.count !== undefined && (
										<span className="px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-primary/20 text-primary">
											{tab.count}
										</span>
									)}
								</div>
							</TabArea.Tab>
						))}
					</TabArea.List>
				</TabArea.Root>
			</div>

			<div className="edit-sticky-body" style={{ '--tab-bar-height': `${tabBarSize.height}px` } as React.CSSProperties}>
				{activeMainTab === 'actions' ? (
					<>
						{/* Inside Actions: Modern Step Navigator Bar */}
						<div className="flex items-center justify-between gap-3 p-1.5 bg-surface-muted/50 rounded-xl border border-border/70 mb-3 mt-1 flex-wrap">
							<div className="flex items-center gap-1.5 flex-wrap">
								<span className="text-3xs font-semibold uppercase tracking-wider text-muted px-1.5">Steps:</span>
								{stepKeys.map((stepId, i) => (
									<StepPill
										key={stepId}
										controlId={controlId}
										stepId={stepId}
										stepIndex={i}
										stepOptions={steps[stepId]?.options}
										isSelected={stepId === currentStepKey}
										isCurrent={runtimeProps.current_step_id === stepId}
										onSelect={() => setSelectedStepId(stepId)}
									/>
								))}

								<Button
									variant="ghost"
									size="sm"
									onClick={service.appendStep}
									title="Add another step (for latching / toggle buttons)"
									className="text-muted hover:text-primary text-xs px-2 py-1 flex items-center gap-1"
								>
									<FontAwesomeIcon icon={faPlus} className="text-2xs" />
									<span className="text-3xs font-medium">Add Step</span>
								</Button>
							</div>

							{stepKeys.length > 1 && (
								<div className="flex items-center gap-1 shrink-0">
									<Button
										variant="ghost"
										size="sm"
										disabled={runtimeProps.current_step_id === currentStepKey || disabledSetStep}
										onClick={() => service.setCurrentStep(currentStepKey)}
										title="Make this step the current active live step"
										className={`text-3xs px-2 py-0.5 font-medium rounded-md ${
											runtimeProps.current_step_id === currentStepKey
												? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
												: 'text-muted hover:text-body'
										}`}
									>
										{runtimeProps.current_step_id === currentStepKey ? '● Live' : 'Set Live'}
									</Button>

									<Button
										variant="ghost"
										size="sm"
										title="Move step left"
										disabled={selectedIndex === 0}
										onClick={() => service.swapSteps(currentStepKey, stepKeys[selectedIndex - 1])}
										className="text-muted hover:text-body p-1"
									>
										<FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										title="Move step right"
										disabled={selectedIndex === stepKeys.length - 1}
										onClick={() => service.swapSteps(currentStepKey, stepKeys[selectedIndex + 1])}
										className="text-muted hover:text-body p-1"
									>
										<FontAwesomeIcon icon={faChevronRight} className="text-xs" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										title="Duplicate step"
										onClick={() => service.duplicateStep(currentStepKey)}
										className="text-muted hover:text-body p-1"
									>
										<FontAwesomeIcon icon={faClone} className="text-xs" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										title="Delete step"
										onClick={() => service.removeStep(currentStepKey)}
										className="text-muted hover:text-danger p-1"
									>
										<FontAwesomeIcon icon={faTrash} className="text-xs" />
									</Button>
								</div>
							)}
						</div>

						{selectedStepProps && (
							<ControlActionStepTab
								service={service}
								controlId={controlId}
								location={location}
								runtimeProps={runtimeProps}
								rotaryActions={rotaryActions}
								stepKeys={stepKeys}
								selectedIndex={selectedIndex}
								selectedKey={currentStepKey}
								selectedStepProps={selectedStepProps}
								localVariablesStore={localVariablesStore}
								disabledSetStep={disabledSetStep}
							/>
						)}
					</>
				) : (
					children && children(activeMainTab)
				)}
			</div>
		</>
	)
})

interface StepPillProps {
	controlId: string
	stepId: string
	stepIndex: number
	stepOptions: ActionStepOptions | undefined
	isSelected: boolean
	isCurrent: boolean
	onSelect: () => void
}

function StepPill({ controlId, stepId, stepIndex, stepOptions, isSelected, isCurrent, onSelect }: StepPillProps) {
	const name = stepOptions?.name || `Step ${stepIndex + 1}`
	const renameStepMutation = useMutationExt(trpc.controls.steps.rename.mutationOptions())

	const [isEditing, setIsEditing] = useState(false)

	const doRename = useCallback(
		(newName: string) => {
			renameStepMutation.mutateAsync({ controlId, stepId, newName }).catch((e) => {
				console.error('Failed to rename step:', e)
			})
		},
		[renameStepMutation, controlId, stepId]
	)

	return (
		<div
			onClick={onSelect}
			onDoubleClick={() => setIsEditing(true)}
			className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all select-none ${
				isSelected
					? 'bg-primary text-white shadow-xs'
					: 'bg-surface hover:bg-surface-hover text-muted hover:text-body border border-border/70'
			}`}
		>
			{isCurrent && (
				<span
					className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`}
					title="Active live step"
				/>
			)}

			{isEditing ? (
				<div onClick={(e) => e.stopPropagation()}>
					<TextInputFieldSimple
						id={undefined}
						value={stepOptions?.name ?? ''}
						setValue={doRename}
						onBlur={() => setIsEditing(false)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === 'Escape') setIsEditing(false)
						}}
						autoFocus
					/>
				</div>
			) : (
				<span>{name}</span>
			)}
		</div>
	)
}
