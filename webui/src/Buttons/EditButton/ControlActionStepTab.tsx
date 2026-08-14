import { faChevronLeft, faChevronRight, faClone, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import type { IControlActionStepsAndSetsService } from '~/Services/Controls/ControlActionStepsAndSetsService.js'
import type { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'
import { EditActionsRelease } from './EditActionsRelease.js'

export interface ControlActionStepTabProps {
	service: IControlActionStepsAndSetsService
	controlId: string
	location: ControlLocation
	runtimeProps: Record<string, any>
	rotaryActions: boolean
	stepKeys: string[]
	selectedIndex: number
	selectedKey: string
	selectedStepProps: NormalButtonSteps[0]
	localVariablesStore: LocalVariablesStore
	disabledSetStep: boolean
}

export function ControlActionStepTab({
	service,
	controlId,
	location,
	runtimeProps,
	rotaryActions,
	stepKeys,
	selectedIndex,
	selectedKey,
	selectedStepProps,
	localVariablesStore,
	disabledSetStep,
}: ControlActionStepTabProps): React.JSX.Element {
	// Heading with an inline hint (no extra vertical space) pointing at the $(this:delta) variable, which is
	// available to expressions inside rotary actions.
	const rotaryHeading = (label: string): React.JSX.Element => (
		<>
			{label}{' '}
			<InlineHelpIcon className="text-muted">
				In an expression here, use $(this:delta) to read this turn's rotation amount and direction (positive =
				right/clockwise, negative = left/counter-clockwise; some surfaces report a larger value for faster spins).
			</InlineHelpIcon>
		</>
	)

	return (
		<>
			{stepKeys.length > 1 && (
				<ButtonGroup className="mt-2">
					<Button
						color="primary"
						title="Move step before"
						disabled={selectedIndex === 0}
						onClick={() => service.swapSteps(selectedKey, stepKeys[selectedIndex - 1])}
					>
						<FontAwesomeIcon icon={faChevronLeft} />
					</Button>
					<Button
						color="primary"
						title="Move step after"
						disabled={selectedIndex === stepKeys.length - 1}
						onClick={() => service.swapSteps(selectedKey, stepKeys[selectedIndex + 1])}
					>
						<FontAwesomeIcon icon={faChevronRight} />
					</Button>

					<Button
						color="success"
						className="font-medium"
						variant={runtimeProps.current_step_id === selectedKey || disabledSetStep ? 'outline' : undefined}
						disabled={runtimeProps.current_step_id === selectedKey || disabledSetStep}
						onClick={() => service.setCurrentStep(selectedKey)}
						title="Make this step the current step, without executing any actions."
					>
						Select
					</Button>
					<Button color="secondary" title="Add step" disabled={stepKeys.length === 1} onClick={service.appendStep}>
						<FontAwesomeIcon icon={faPlus} />
					</Button>
					<Button color="secondary" title="Duplicate step" onClick={() => service.duplicateStep(selectedKey)}>
						<FontAwesomeIcon icon={faClone} />
					</Button>
					<Button
						color="secondary"
						title="Delete step"
						disabled={stepKeys.length === 1}
						onClick={() => service.removeStep(selectedKey)}
					>
						<FontAwesomeIcon icon={faTrash} />
					</Button>
				</ButtonGroup>
			)}

			<div className="mt-2">
				{' '}
				{/* Wrap the entity-category, for :first-child to work */}
				{rotaryActions && selectedStepProps && (
					<>
						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading={rotaryHeading('Rotate left actions')}
								controlId={controlId}
								location={location}
								listId={{ stepId: selectedKey, setId: 'rotate_left' }}
								entities={selectedStepProps.action_sets['rotate_left']}
								entityType={EntityModelType.Action}
								entityTypeLabel="action"
								feedbackListType={null}
								localVariablesStore={localVariablesStore}
								localVariablePrefix={null}
							/>
						</MyErrorBoundary>

						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading={rotaryHeading('Rotate right actions')}
								controlId={controlId}
								location={location}
								listId={{ stepId: selectedKey, setId: 'rotate_right' }}
								entities={selectedStepProps.action_sets['rotate_right']}
								entityType={EntityModelType.Action}
								entityTypeLabel="action"
								feedbackListType={null}
								localVariablesStore={localVariablesStore}
								localVariablePrefix={null}
							/>
						</MyErrorBoundary>
					</>
				)}
				{selectedStepProps && (
					<>
						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading={`Press actions`}
								controlId={controlId}
								location={location}
								listId={{ stepId: selectedKey, setId: 'down' }}
								entities={selectedStepProps.action_sets['down']}
								entityType={EntityModelType.Action}
								entityTypeLabel="action"
								feedbackListType={null}
								localVariablesStore={localVariablesStore}
								localVariablePrefix={null}
							/>
						</MyErrorBoundary>

						<EditActionsRelease
							controlId={controlId}
							location={location}
							action_sets={selectedStepProps.action_sets}
							stepOptions={selectedStepProps.options}
							stepId={selectedKey}
							removeSet={service.removeSet}
							localVariablesStore={localVariablesStore}
						/>
					</>
				)}
			</div>

			<div className="my-4">
				<Button onClick={() => service.appendSet(selectedKey)} color="primary">
					<FontAwesomeIcon icon={faPlus} /> Add duration group
				</Button>
			</div>
		</>
	)
}
