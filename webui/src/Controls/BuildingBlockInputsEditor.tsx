import type { AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import {
	InputFieldDefinitionsEditor,
	type InputFieldDefinitionsService,
} from '~/Components/InputFieldDefinitionsEditor/InputFieldDefinitionsEditor.js'
import { LocalVariablesSupportHint } from '~/Controls/InputFeatures.js'

interface BuildingBlockInputsEditorProps {
	/** Edits the inputs, with each kind's own procedures */
	service: InputFieldDefinitionsService
	inputs: AuthorableInputField[]
	/** What the building block is used as, and is made of, such as `action` */
	usedAs: 'action' | 'feedback'
	collapseStorageId: string
}

/**
 * The inputs of a building block, such as a custom action, which are the options of whatever uses it
 */
export function BuildingBlockInputsEditor({
	service,
	inputs,
	usedAs,
	collapseStorageId,
}: BuildingBlockInputsEditorProps): React.JSX.Element {
	return (
		<InputFieldDefinitionsEditor
			heading="Inputs"
			subheading={
				<>
					<p className="text-sm text-muted mb-1">
						The inputs are the options of the {usedAs}. Their values are available to the {usedAs}s as{' '}
						<code>$(options:id)</code>.
					</p>
					<LocalVariablesSupportHint subject="Inputs" />
				</>
			}
			headingActions={null}
			fields={inputs}
			service={service}
			readonly={false}
			localVariablesStore={null}
			collapseStorageId={collapseStorageId}
		/>
	)
}
