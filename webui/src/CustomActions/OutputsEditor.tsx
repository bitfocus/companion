import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo, useRef } from 'react'
import type { JsonValue } from 'type-fest'
import type { CustomActionOutput } from '@companion-app/shared/Model/CustomActionModel.js'
import type { ExpressionOrValue, SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { Button } from '~/Components/Button.js'
import { Form } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import {
	isInputFieldIdValid,
	makeInputFieldIdUnique,
	setInputFieldLabel,
} from '~/Components/InputFieldDefinitionsEditor/InputFieldTypes.js'
import { ListHeading } from '~/Components/ListHeading.js'
import '~/Controls/Components/EntityList.css'
import { OptionsInputField } from '~/Controls/OptionsInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'

interface CustomActionOutputsEditorProps {
	controlId: string
	outputs: CustomActionOutput[]
	/** The names of the local variables of the custom action, which an output can come from */
	variableNames: string[]
}

/**
 * Edit the outputs of a custom action, each of which is one of its local variables
 */
export const CustomActionOutputsEditor = observer(function CustomActionOutputsEditor({
	controlId,
	outputs,
	variableNames,
}: CustomActionOutputsEditorProps): React.JSX.Element {
	const addMutation = useMutationExt(trpc.controls.customActions.outputAdd.mutationOptions())
	const removeMutation = useMutationExt(trpc.controls.customActions.outputRemove.mutationOptions())
	const updateMutation = useMutationExt(trpc.controls.customActions.outputUpdate.mutationOptions())

	const allIds = useMemo(() => new Set(outputs.map((output) => output.id)), [outputs])

	const addOutput = useCallback(() => {
		const id = makeInputFieldIdUnique('output', allIds)
		const label = id === 'output' ? 'Output' : `Output ${id.slice('output_'.length)}`
		addMutation
			.mutateAsync({ controlId, output: { id, label, variableName: variableNames[0] ?? '' } })
			.catch((e) => console.error('Failed to add output', e))
	}, [addMutation, controlId, allIds, variableNames])

	const confirmModal = useRef<GenericConfirmModalRef>(null)
	const removeOutput = useCallback(
		(output: CustomActionOutput) =>
			confirmModal.current?.show('Delete output', `Delete output "${output.label || output.id}"?`, 'Delete', () => {
				removeMutation
					.mutateAsync({ controlId, outputId: output.id })
					.catch((e) => console.error('Failed to remove output', e))
			}),
		[removeMutation, controlId]
	)

	const updateOutput = useCallback(
		(outputId: string, output: CustomActionOutput) => {
			updateMutation
				.mutateAsync({ controlId, outputId, output })
				.catch((e) => console.error('Failed to update output', e))
		},
		[updateMutation, controlId]
	)

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<ListHeading
				heading="Outputs"
				subheading={
					<p className="text-sm text-muted">
						Each output is one of the local variables. Whenever a run sets it, its value is written to wherever the
						action calling this one chooses.
					</p>
				}
				actions={null}
				collapse={null}
			/>

			<div className="entity-list">
				{outputs.map((output, index) => (
					// The index is used as the key, as the id changes while the label is being typed
					<OutputRow
						key={index}
						output={output}
						allIds={allIds}
						variableNames={variableNames}
						updateOutput={updateOutput}
						removeOutput={removeOutput}
					/>
				))}
			</div>

			<div className="add-dropdown-wrapper">
				<Button color="secondary" size="sm" onClick={addOutput}>
					<FontAwesomeIcon icon={faPlus} className="me-1" />
					Add output
				</Button>
			</div>
		</>
	)
})

const labelField: SomeCompanionInputField = { type: 'textinput', id: 'label', label: 'Label', default: '' }

interface OutputRowProps {
	output: CustomActionOutput
	allIds: ReadonlySet<string>
	variableNames: string[]
	updateOutput: (outputId: string, output: CustomActionOutput) => void
	removeOutput: (output: CustomActionOutput) => void
}

function OutputRow({ output, allIds, variableNames, updateOutput, removeOutput }: OutputRowProps): React.JSX.Element {
	const otherIds = useMemo(() => {
		const ids = new Set(allIds)
		ids.delete(output.id)
		return ids
	}, [allIds, output.id])

	const idField = useMemo(
		(): SomeCompanionInputField => ({
			type: 'textinput',
			id: 'id',
			label: 'Id',
			default: '',
			regex: '/^[\\w-]+$/',
		}),
		[]
	)

	const variableField = useMemo(
		(): SomeCompanionInputField => ({
			type: 'dropdown',
			id: 'variableName',
			label: 'Local variable',
			description: variableNames.length > 0 ? undefined : 'Add a local variable for the output to come from',
			default: '',
			choices: [{ id: '', label: 'None' }, ...variableNames.map((name) => ({ id: name, label: name }))],
		}),
		[variableNames]
	)

	const setValue = useCallback(
		(key: string, value: ExpressionOrValue<JsonValue | undefined>) => {
			const newValue = stringifyVariableValue(value.value) ?? ''
			switch (key) {
				case 'label':
					updateOutput(output.id, setInputFieldLabel(output, newValue, otherIds))
					break
				case 'id':
					// Ignore ids which can't be used, so that the output keeps a usable id
					if (isInputFieldIdValid(newValue, otherIds)) updateOutput(output.id, { ...output, id: newValue })
					break
				case 'variableName':
					updateOutput(output.id, { ...output, variableName: newValue })
					break
			}
		},
		[updateOutput, output, otherIds]
	)

	return (
		<div className="entity-row">
			<div className="entity-row-content">
				<div className="editor-grid-header flex items-center justify-between gap-3">
					<span className="font-semibold text-xs text-body leading-tight truncate" title={output.label || output.id}>
						{output.label || output.id}
					</span>
					<div className="cell-controls flex items-center gap-0.5 shrink-0">
						<Button
							size="sm"
							className="p-1.5"
							onClick={() => removeOutput(output)}
							title="Remove output"
							variant="ghost"
							color="danger"
						>
							<FontAwesomeIcon icon={faTrash} className="text-xs" />
						</Button>
					</div>
				</div>

				<div className="editor-grid">
					<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
						{[labelField, idField, variableField].map((field) => (
							<OptionsInputField
								key={field.id}
								allowInternalFields={false}
								isLocatedInGrid={false}
								entityType={null}
								option={field}
								value={{ isExpression: false, value: output[field.id as keyof CustomActionOutput] }}
								setValue={setValue}
								visibility={true}
								localVariablesStore={null}
								fieldSupportsExpression={false}
							/>
						))}
					</Form>
				</div>
			</div>
		</div>
	)
}
