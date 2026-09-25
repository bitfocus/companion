import { faHandPointer, faPlus, faRotateLeft, faRotateRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { Button } from '~/Components/Button'
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
	rotaryActions,
	selectedKey,
	selectedStepProps,
	localVariablesStore,
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
			<div className="edit-button-action-sections">
				{rotaryActions && selectedStepProps && (
					<>
						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading={
									<div className="flex items-center gap-2">
										<FontAwesomeIcon icon={faRotateLeft} className="text-primary text-xs" />
										{rotaryHeading('Rotate Left actions')}
									</div>
								}
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
								heading={
									<div className="flex items-center gap-2">
										<FontAwesomeIcon icon={faRotateRight} className="text-primary text-xs" />
										{rotaryHeading('Rotate Right actions')}
									</div>
								}
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
								heading={
									<div className="flex items-center gap-2">
										<FontAwesomeIcon icon={faHandPointer} className="text-primary text-xs" />
										<span>Press actions</span>
									</div>
								}
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

			<div className="edit-button-add-duration">
				<Button onClick={() => service.appendSet(selectedKey)} color="primary" variant="outline" size="sm">
					<FontAwesomeIcon icon={faPlus} /> Add duration group
				</Button>
			</div>
		</>
	)
}
