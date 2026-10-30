import { useMemo } from 'react'
import type { AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import {
	InputFieldDefinitionsEditor,
	type InputFieldDefinitionsService,
} from '~/Components/InputFieldDefinitionsEditor/InputFieldDefinitionsEditor.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface CustomEntityInputsEditorProps {
	controlId: string
	/** Which kind of custom entity the control is */
	kind: 'customActions' | 'customFeedbacks'
	inputs: AuthorableInputField[]
	/** Explains what the inputs are */
	subheading: React.ReactNode
}

/**
 * Edit the user defined inputs of a custom action or feedback
 */
export function CustomEntityInputsEditor({
	controlId,
	kind,
	inputs,
	subheading,
}: CustomEntityInputsEditorProps): React.JSX.Element {
	const router = trpc.controls[kind]
	const addMutation = useMutationExt(router.inputAdd.mutationOptions())
	const removeMutation = useMutationExt(router.inputRemove.mutationOptions())
	const moveMutation = useMutationExt(router.inputMove.mutationOptions())
	const updateMutation = useMutationExt(router.inputUpdate.mutationOptions())

	const service = useMemo(
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

	return (
		<InputFieldDefinitionsEditor
			heading="Inputs"
			subheading={subheading}
			headingActions={null}
			fields={inputs}
			service={service}
			readonly={false}
			localVariablesStore={null}
			collapseStorageId={`custom_entity_inputs_${controlId}`}
		/>
	)
}
