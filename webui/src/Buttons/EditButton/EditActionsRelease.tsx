import { ActionSetsModel, ActionStepOptions, ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { SomeEntityModel, EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { CButton } from '@coreui/react'
import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useContext, useRef, useCallback } from 'react'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { SocketContext, MyErrorBoundary } from '~/util.js'
import {
	EditDurationGroupPropertiesModalRef,
	EditDurationGroupPropertiesModal,
} from './EditDurationGroupPropertiesModal.js'

interface EditActionsReleaseProps {
	controlId: string
	location: ControlLocation
	action_sets: ActionSetsModel
	stepOptions: ActionStepOptions
	stepId: string
	removeSet: (stepId: string, setId: ActionSetId) => void
}

export function EditActionsRelease({
	controlId,
	location,
	action_sets,
	stepOptions,
	stepId,
	removeSet,
}: EditActionsReleaseProps): React.JSX.Element {
	const socket = useContext(SocketContext)

	const editRef = useRef<EditDurationGroupPropertiesModalRef>(null)

	const configureSet = useCallback(
		(oldId: string | number) => {
			if (editRef.current) {
				const oldIdNumber = Number(oldId)
				if (isNaN(oldIdNumber)) return

				const runWhileHeld = stepOptions.runWhileHeld.includes(oldIdNumber)
				editRef.current?.show(oldIdNumber, runWhileHeld, (newId: number, runWhileHeld: boolean) => {
					if (!isNaN(newId)) {
						socket
							.emitPromise('controls:action-set:rename', [controlId, stepId, oldIdNumber, newId])
							.then(() => {
								socket
									.emitPromise('controls:action-set:set-run-while-held', [controlId, stepId, newId, runWhileHeld])
									.catch((e) => {
										console.error('Failed to set runWhileHeld:', e)
									})
							})
							.catch((e) => {
								console.error('Failed to rename set:', e)
							})
					}
				})
			}
		},
		[socket, controlId, stepId, stepOptions]
	)

	const candidate_sets = Object.entries(action_sets)
		.map((o): [number, SomeEntityModel[] | undefined] => [Number(o[0]), o[1]])
		.filter(([id]) => !isNaN(id))
	candidate_sets.sort((a, b) => a[0] - b[0])

	const components = candidate_sets.map(([id, actions]) => {
		const runWhileHeld = stepOptions.runWhileHeld.includes(Number(id))
		const ident = runWhileHeld ? `Held for ${id}ms` : `Release after ${id}ms`
		return (
			<MyErrorBoundary key={id}>
				<ControlEntitiesEditor
					key={id}
					heading={`${ident} actions`}
					headingActions={[
						<CButton key="rename" color="white" title="Configure" size="sm" onClick={() => configureSet(id)}>
							<FontAwesomeIcon icon={faPencil} />
						</CButton>,
						<CButton key="delete" color="white" title="Delete step" size="sm" onClick={() => removeSet(stepId, id)}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>,
					]}
					controlId={controlId}
					location={location}
					listId={{ stepId, setId: id }}
					entities={actions}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					onlyFeedbackType={null}
				/>
			</MyErrorBoundary>
		)
	})

	return (
		<>
			<EditDurationGroupPropertiesModal ref={editRef} />

			<MyErrorBoundary>
				<ControlEntitiesEditor
					heading={candidate_sets.length ? 'Short release actions' : 'Release actions'}
					controlId={controlId}
					location={location}
					listId={{ stepId, setId: 'up' }}
					entities={action_sets['up']}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					onlyFeedbackType={null}
				/>
			</MyErrorBoundary>

			{components}
		</>
	)
}
