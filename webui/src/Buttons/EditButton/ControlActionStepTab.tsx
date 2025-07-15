import { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { CButtonGroup, CButton } from '@coreui/react'
import { faChevronLeft, faChevronRight, faPlus, faCopy, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { IControlActionStepsAndSetsService } from '~/Services/Controls/ControlActionStepsAndSetsService.js'
import { MyErrorBoundary } from '~/util.js'
import { EditActionsRelease } from './EditActionsRelease.js'
import { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'

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
	return (
		<>
			<CButtonGroup hidden={stepKeys.length === 1} className="mt-2">
				<CButton
					color="danger"
					title="Move step before"
					disabled={selectedIndex === 0}
					onClick={() => service.swapSteps(selectedKey, stepKeys[selectedIndex - 1])}
				>
					<FontAwesomeIcon icon={faChevronLeft} />
				</CButton>
				<CButton
					color="danger"
					title="Move step after"
					disabled={selectedIndex === stepKeys.length - 1}
					onClick={() => service.swapSteps(selectedKey, stepKeys[selectedIndex + 1])}
				>
					<FontAwesomeIcon icon={faChevronRight} />
				</CButton>

				<CButton
					color="success"
					style={{
						fontWeight: 'bold',
						opacity: runtimeProps.current_step_id === selectedKey || disabledSetStep ? 0.3 : 1,
					}}
					disabled={runtimeProps.current_step_id === selectedKey || disabledSetStep}
					onClick={() => service.setCurrentStep(selectedKey)}
					title="Make this step the current step, without executing any actions."
				>
					Select
				</CButton>
				<CButton
					style={{ backgroundColor: '#f0f0f0', marginRight: 1 }}
					title="Add step"
					disabled={stepKeys.length === 1}
					onClick={service.appendStep}
				>
					<FontAwesomeIcon icon={faPlus} />
				</CButton>
				<CButton
					style={{ backgroundColor: '#f0f0f0' }}
					title="Duplicate step"
					onClick={() => service.duplicateStep(selectedKey)}
				>
					<FontAwesomeIcon icon={faCopy} />
				</CButton>
				<CButton
					style={{ backgroundColor: '#f0f0f0' }}
					title="Delete step"
					disabled={stepKeys.length === 1}
					onClick={() => service.removeStep(selectedKey)}
				>
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
			</CButtonGroup>

			<div className="mt-10">
				{/* Wrap the entity-category, for :first-child to work */}

				{rotaryActions && selectedStepProps && (
					<>
						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading="Rotate left actions"
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
								heading="Rotate right actions"
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

			<br />
			<p>
				<CButton onClick={() => service.appendSet(selectedKey)} color="primary">
					<FontAwesomeIcon icon={faPlus} /> Add duration group
				</CButton>
			</p>
		</>
	)
}
