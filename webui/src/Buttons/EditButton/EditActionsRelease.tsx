import { faClock, faHand, faPencil, faStopwatch, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useRef } from 'react'
import type { ActionSetsModel, ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { Button } from '~/Components/Button'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { IControlActionStepsAndSetsService } from '~/Services/Controls/ControlActionStepsAndSetsService.js'
import type { LocalVariablesStore } from '../../Controls/LocalVariablesStore.js'
import { ActionSetControlEventsCheckbox } from './ActionSetControlEventsCheckbox.js'
import {
	EditDurationGroupPropertiesModal,
	type EditDurationGroupPropertiesModalRef,
} from './EditDurationGroupPropertiesModal.js'

interface EditActionsReleaseProps {
	controlId: string
	location: ControlLocation
	action_sets: ActionSetsModel
	stepOptions: ActionStepOptions
	stepId: string
	service: IControlActionStepsAndSetsService
	removeSet: (stepId: string, setId: number) => void
	localVariablesStore: LocalVariablesStore
}

export function EditActionsRelease({
	controlId,
	location,
	action_sets,
	stepOptions,
	stepId,
	service,
	removeSet,
	localVariablesStore,
}: EditActionsReleaseProps): React.JSX.Element {
	const editRef = useRef<EditDurationGroupPropertiesModalRef>(null)

	const renameMutation = useMutationExt(trpc.controls.actionSets.rename.mutationOptions())
	const setRunWhileHeldMutation = useMutationExt(trpc.controls.actionSets.setRunWhileHeld.mutationOptions())

	const configureSet = useCallback(
		(oldId: string | number) => {
			if (editRef.current) {
				const oldIdNumber = Number(oldId)
				if (isNaN(oldIdNumber)) return

				const runWhileHeld = stepOptions.runWhileHeld.includes(oldIdNumber)
				const controlEvents = !stepOptions.controlEventsDisabledSets?.includes(oldIdNumber)
				editRef.current?.show(
					oldIdNumber,
					runWhileHeld,
					controlEvents,
					(newId: number, newRunWhileHeld: boolean, newControlEvents: boolean) => {
						if (!isNaN(newId)) {
							const renamePromise =
								newId === oldIdNumber
									? Promise.resolve(true)
									: renameMutation.mutateAsync({ controlId, stepId, oldSetId: oldIdNumber, newSetId: newId })

							renamePromise
								.then(async (renamed) => {
									if (!renamed) return

									if (newRunWhileHeld !== runWhileHeld) {
										await setRunWhileHeldMutation
											.mutateAsync({ controlId, stepId, setId: newId, runWhileHeld: newRunWhileHeld })
											.catch((e) => {
												console.error('Failed to set runWhileHeld:', e)
											})
									}
									if (newControlEvents !== controlEvents) {
										service.setControlEvents(stepId, newId, newControlEvents)
									}
								})
								.catch((e) => {
									console.error('Failed to rename set:', e)
								})
						}
					}
				)
			}
		},
		[renameMutation, setRunWhileHeldMutation, service, controlId, stepId, stepOptions]
	)

	const candidate_sets = Object.entries(action_sets)
		.map((o): [number, SomeEntityModel[] | undefined] => [Number(o[0]), o[1]])
		.filter(([id]) => !isNaN(id))
	candidate_sets.sort((a, b) => a[0] - b[0])

	const components = candidate_sets.map(([id, actions]) => {
		const runWhileHeld = stepOptions.runWhileHeld.includes(Number(id))
		const ident = runWhileHeld ? `Held for ${id}ms` : `Release after ${id}ms`
		const icon = runWhileHeld ? faStopwatch : faClock
		const iconColor = runWhileHeld ? 'text-tone-warning-text' : 'text-muted'

		return (
			<MyErrorBoundary key={id}>
				<ControlEntitiesEditor
					key={id}
					heading={
						<div className="flex items-center gap-2">
							<FontAwesomeIcon icon={icon} className={`${iconColor} text-xs`} />
							<span>{ident} actions</span>
						</div>
					}
					headingActions={[
						<Button key="rename" title="Configure" size="sm" onClick={() => configureSet(id)}>
							<FontAwesomeIcon icon={faPencil} />
						</Button>,
						<Button
							key="delete"
							title="Delete step"
							size="sm"
							onClick={() => removeSet(stepId, id)}
							variant="ghost"
							color="danger"
						>
							<FontAwesomeIcon icon={faTrash} />
						</Button>,
					]}
					controlId={controlId}
					location={location}
					listId={{ stepId, setId: id }}
					entities={actions}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					feedbackListType={null}
					localVariablesStore={localVariablesStore}
					localVariablePrefix={null}
				/>
			</MyErrorBoundary>
		)
	})

	return (
		<>
			<EditDurationGroupPropertiesModal ref={editRef} />

			<MyErrorBoundary>
				<ControlEntitiesEditor
					heading={
						<div className="flex items-center gap-2">
							<FontAwesomeIcon icon={faHand} className="text-secondary text-xs" />
							<span>{candidate_sets.length ? 'Short release actions' : 'Release actions'}</span>
						</div>
					}
					headingActions={[
						<ActionSetControlEventsCheckbox
							key="control-events"
							enabled={!stepOptions.controlEventsDisabledSets?.includes('up')}
							setEnabled={(enabled) => service.setControlEvents(stepId, 'up', enabled)}
						/>,
					]}
					controlId={controlId}
					location={location}
					listId={{ stepId, setId: 'up' }}
					entities={action_sets['up']}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					feedbackListType={null}
					localVariablesStore={localVariablesStore}
					localVariablePrefix={null}
				/>
			</MyErrorBoundary>

			{components}
		</>
	)
}
