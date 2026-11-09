import { useDragDropMonitor } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo, useRef } from 'react'
import type { AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { usePanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { AddDropdown } from '../AddDropdown.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '../GenericConfirmModal.js'
import { ListHeading } from '../ListHeading.js'
import '~/Controls/Components/EntityList.css'
import { InputFieldDefinitionRow } from './InputFieldDefinitionRow.js'
import { createInputField, getInputFieldTypeSpec, InputFieldTypeSpecs } from './InputFieldTypes.js'

const typeChoices = InputFieldTypeSpecs.map((spec) => ({ id: spec.type, label: spec.label }))

/**
 * The operations to change a list of input field definitions
 */
export interface InputFieldDefinitionsService {
	addField(field: AuthorableInputField): void
	removeField(fieldId: string): void
	/** Move a field to a new position in the list */
	moveField(fieldId: string, index: number): void
	/** Replace a field. The new field may have a different id to the old one, which means it has been renamed */
	updateField(fieldId: string, field: AuthorableInputField): void
}

export interface InputFieldDefinitionsEditorProps {
	heading: React.ReactNode
	/** Shown below the heading, such as what the fields are for */
	subheading: React.ReactNode
	/** Buttons shown in the heading */
	headingActions: React.ReactNode
	fields: AuthorableInputField[]
	service: InputFieldDefinitionsService
	readonly: boolean
	/** The local variables to offer when editing the default values */
	localVariablesStore: LocalVariablesStore | null
	/** Where to remember which fields are collapsed */
	collapseStorageId: string
}

/**
 * An editor for a user defined list of input fields, such as the inputs of a custom action.
 * It is laid out like the list of actions or events of a control
 */
export const InputFieldDefinitionsEditor = observer(function InputFieldDefinitionsEditor({
	heading,
	subheading,
	headingActions,
	fields,
	service,
	readonly,
	localVariablesStore,
	collapseStorageId,
}: InputFieldDefinitionsEditorProps): React.JSX.Element {
	const fieldIds = useMemo(() => fields.map((field) => field.id), [fields])
	const allIds = useMemo(() => new Set(fieldIds), [fieldIds])

	const panelCollapseHelper = usePanelCollapseHelperLite(collapseStorageId, fieldIds)

	const addField = useCallback(
		(type: string | number) => {
			const spec = getInputFieldTypeSpec(type as AuthorableInputField['type'])
			if (spec) service.addField(createInputField(spec.type, allIds))
		},
		[service, allIds]
	)

	const confirmModal = useRef<GenericConfirmModalRef>(null)
	const removeField = useCallback(
		(field: AuthorableInputField) =>
			confirmModal.current?.show('Delete input', `Delete input "${field.label || field.id}"?`, 'Delete', () =>
				service.removeField(field.id)
			),
		[service]
	)

	const dragId = `input_fields_${collapseStorageId}`
	useDragDropMonitor({
		onDragEnd(event) {
			if (event.canceled) return
			const { source } = event.operation
			if (!source || source.type !== dragId || !isSortable(source)) return
			const { initialIndex, index } = source
			const field = fields[initialIndex]
			if (initialIndex === index || !field) return
			service.moveField(field.id, index)
		},
	})

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<ListHeading
				heading={heading}
				subheading={subheading}
				actions={headingActions}
				collapse={
					fields.length > 0
						? {
								canExpandAll: panelCollapseHelper.canExpandAll(),
								canCollapseAll: panelCollapseHelper.canCollapseAll(),
								expandAll: panelCollapseHelper.setAllExpanded,
								collapseAll: panelCollapseHelper.setAllCollapsed,
							}
						: null
				}
			/>

			<div className="entity-list">
				{fields.map((field, index) => (
					// The index is used as the key, as the id changes while the label is being typed
					<MyErrorBoundary key={index}>
						<InputFieldDefinitionRow
							field={field}
							index={index}
							dragId={dragId}
							allIds={allIds}
							service={service}
							removeField={removeField}
							panelCollapseHelper={panelCollapseHelper}
							readonly={readonly}
							localVariablesStore={localVariablesStore}
						/>
					</MyErrorBoundary>
				))}
			</div>

			{!readonly && (
				<div className="add-dropdown-wrapper">
					<AddDropdown
						choices={typeChoices}
						placeholder="+ Add input"
						noOptionsMessage="No types of input found"
						onSelect={addField}
					/>
				</div>
			)}
		</>
	)
})
