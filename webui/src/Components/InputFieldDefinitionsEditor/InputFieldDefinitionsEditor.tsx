import { faList, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo } from 'react'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { Button } from '../Button.js'
import { NonIdealState } from '../NonIdealState.js'
import { InputFieldDefinitionRow } from './InputFieldDefinitionRow.js'
import { createInputField } from './InputFieldTypes.js'
import './InputFieldDefinitionsEditor.css'

/**
 * The operations to change a list of input field definitions
 */
export interface InputFieldDefinitionsService {
	addField(field: SomeCompanionInputField): void
	removeField(fieldId: string): void
	moveField(fieldId: string, direction: -1 | 1): void
	/** Replace a field. The new field may have a different id to the old one, which means it has been renamed */
	updateField(fieldId: string, field: SomeCompanionInputField): void
}

export interface InputFieldDefinitionsEditorProps {
	fields: SomeCompanionInputField[]
	service: InputFieldDefinitionsService
	readonly: boolean
	/** The local variables to offer when editing the default values */
	localVariablesStore: LocalVariablesStore | null
}

/**
 * An editor for a user defined list of input fields, such as the inputs of a custom action
 */
export const InputFieldDefinitionsEditor = observer(function InputFieldDefinitionsEditor({
	fields,
	service,
	readonly,
	localVariablesStore,
}: InputFieldDefinitionsEditorProps): React.JSX.Element {
	const allIds = useMemo(() => new Set(fields.map((field) => field.id)), [fields])

	const addField = useCallback(() => service.addField(createInputField(allIds)), [service, allIds])

	return (
		<div className="input-field-definitions-editor">
			{fields.length === 0 && <NonIdealState icon={faList} text="There are no inputs" className="py-2" />}

			{fields.map((field, index) => (
				// The index is used as the key, as the id changes while the label is being typed
				<InputFieldDefinitionRow
					key={index}
					field={field}
					index={index}
					count={fields.length}
					allIds={allIds}
					service={service}
					readonly={readonly}
					localVariablesStore={localVariablesStore}
				/>
			))}

			{!readonly && (
				<Button color="secondary" size="sm" onClick={addField}>
					<FontAwesomeIcon icon={faPlus} className="me-1" />
					Add input
				</Button>
			)}
		</div>
	)
})
