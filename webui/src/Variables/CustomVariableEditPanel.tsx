import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId, useRef } from 'react'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { FormLabel } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { InlineHelpIcon } from '~/Components/InlineHelp'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import VariableInputGroup from '~/Components/VariableInputGroup.js'
import { NotesAfterSection } from '~/Controls/Notes.js'
import { useNotesEditor } from '~/Controls/useNotesEditor.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCustomVariablesApi } from './CustomVariablesApi'
import { useVariablesValuesForLabel } from './useVariablesValuesForLabel'
import { VariableReferenceRow } from './VariableReferenceRow.js'

interface CustomVariableEditPanelProps {
	name: string
}

export const CustomVariableEditPanel = observer(function CustomVariableEditPanel({
	name,
}: CustomVariableEditPanelProps) {
	const { variablesStore } = useContext(RootAppStoreContext)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const customVariablesApi = useCustomVariablesApi(confirmModalRef)
	const customVariableValues = useVariablesValuesForLabel('custom')

	const info = variablesStore.customVariables.get(name)
	const value = customVariableValues.get(name)

	const persistFieldId = useId()
	const descriptionFieldId = useId()
	const currentValueFieldId = useId()
	const startupValueFieldId = useId()

	const setNotes = useCallback((notes: string) => customVariablesApi.setNotes(name, notes), [customVariablesApi, name])
	const notesState = useNotesEditor(`custom:${name}`, info?.notes, setNotes)

	if (!info) return null

	const fullname = `$(custom:${name})`

	return (
		<div className="edit-panel">
			<GenericConfirmModal ref={confirmModalRef} />

			<EditSectionCard title="General Settings">
				<VariableReferenceRow reference={fullname} notesState={notesState} />
				<div className="edit-field-row">
					<FormLabel htmlFor={descriptionFieldId}>Description</FormLabel>
					<TextInputFieldSimple
						id={descriptionFieldId}
						value={info.description}
						setValue={(description) => customVariablesApi.setDescription(name, description)}
					/>
				</div>
			</EditSectionCard>

			<NotesAfterSection state={notesState} />

			<EditSectionCard title="Value">
				<div className="edit-field-row">
					<FormLabel htmlFor={currentValueFieldId}>Current value</FormLabel>
					<VariableInputGroup
						id={currentValueFieldId}
						value={value}
						setValue={(val) => customVariablesApi.setCurrentValue(name, val)}
					/>
				</div>
				<div className="edit-field-row">
					<FormLabel htmlFor={persistFieldId}>
						Persist value
						<InlineHelpIcon className="ms-1">
							If enabled, variable value will be saved and restored when Companion restarts.
						</InlineHelpIcon>
					</FormLabel>
					<div>
						<SwitchInputField
							id={persistFieldId}
							value={info.persistCurrentValue}
							setValue={(val) => customVariablesApi.setPersistenceValue(name, val)}
						/>
					</div>
				</div>
				<div className="edit-field-row">
					<FormLabel htmlFor={startupValueFieldId}>Startup value</FormLabel>
					<VariableInputGroup
						id={startupValueFieldId}
						disabled={!!info.persistCurrentValue}
						value={info.defaultValue}
						setValue={(val) => customVariablesApi.setStartupValue(name, val)}
					/>
				</div>
			</EditSectionCard>
		</div>
	)
})
