import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ButtonReferenceButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ButtonReferenceEditor } from './ButtonReferenceEditor.js'
import { ControlHotPressButtons } from './ControlHotPressButtons.js'
import { ConvertToNormalButton } from './ConvertToNormalButton.js'
import { EditButtonLayout } from './EditButtonLayout.js'

interface ButtonReferencePanelProps {
	controlId: SomeControlId
	location: ControlLocation
	config: ButtonReferenceButtonModel
	navigateToControl: ((location: ControlLocation) => void) | undefined
}

export function ButtonReferencePanel({
	controlId,
	location,
	config,
	navigateToControl,
}: ButtonReferencePanelProps): React.JSX.Element {
	const setControlNotes = useControlNotesSetter(controlId, 'button-reference')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)

	return (
		<EditButtonLayout
			controlId={controlId}
			location={location}
			typeLabel="Button reference"
			liveStep={null}
			// The referenced button may use rotary actions
			testControls={<ControlHotPressButtons location={location} showRotaries />}
			actions={<ConvertToNormalButton location={location} />}
			notesState={notesState}
			editorTabs={null}
		>
			<MyErrorBoundary>
				<ButtonReferenceEditor config={config} controlId={controlId} navigateToControl={navigateToControl} />
			</MyErrorBoundary>
		</EditButtonLayout>
	)
}
