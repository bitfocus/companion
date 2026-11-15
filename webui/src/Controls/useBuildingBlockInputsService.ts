import { useMemo } from 'react'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { InputFieldDefinitionsService } from '~/Components/InputFieldDefinitionsEditor/InputFieldDefinitionsEditor.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

/**
 * The service to edit the inputs of a building block, such as a custom action or custom feedback
 * @param controlId The control id of the building block
 */
export function useBuildingBlockInputsService(controlId: SomeControlId): InputFieldDefinitionsService {
	const addMutation = useMutationExt(trpc.controls.buildingBlockInputs.add.mutationOptions())
	const removeMutation = useMutationExt(trpc.controls.buildingBlockInputs.remove.mutationOptions())
	const moveMutation = useMutationExt(trpc.controls.buildingBlockInputs.move.mutationOptions())
	const updateMutation = useMutationExt(trpc.controls.buildingBlockInputs.update.mutationOptions())

	return useMemo(
		(): InputFieldDefinitionsService => ({
			addField: (field) => {
				addMutation.mutateAsync({ controlId, field }).catch((e) => console.error('Failed to add input', e))
			},
			removeField: (inputId) => {
				removeMutation.mutateAsync({ controlId, inputId }).catch((e) => console.error('Failed to remove input', e))
			},
			moveField: (inputId, index) => {
				moveMutation.mutateAsync({ controlId, inputId, index }).catch((e) => console.error('Failed to move input', e))
			},
			updateField: (inputId, field) => {
				updateMutation
					.mutateAsync({ controlId, inputId, field })
					.catch((e) => console.error('Failed to update input', e))
			},
		}),
		[addMutation, removeMutation, moveMutation, updateMutation, controlId]
	)
}
