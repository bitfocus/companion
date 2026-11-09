import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { PresetReferenceButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ControlHotPressButtons } from './ControlHotPressButtons.js'
import { ConvertToNormalButton } from './ConvertToNormalButton.js'
import { EditButtonLayout } from './EditButtonLayout.js'
import { PresetReferenceEditor } from './PresetReferenceEditor.js'

interface PresetReferencePanelProps {
	controlId: SomeControlId
	location: ControlLocation
	config: PresetReferenceButtonModel
}

export function PresetReferencePanel({ controlId, location, config }: PresetReferencePanelProps): React.JSX.Element {
	const setControlNotes = useControlNotesSetter(controlId, 'preset-reference')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)

	return (
		<EditButtonLayout
			controlId={controlId}
			location={location}
			typeLabel="Preset reference"
			liveStep={null}
			testControls={<ControlHotPressButtons location={location} showRotaries={config.options.rotaryActions} />}
			actions={<ConvertToNormalButton location={location} />}
			notesState={notesState}
			editorTabs={null}
		>
			<MyErrorBoundary>
				<PresetReferenceEditor config={config} location={location} />
			</MyErrorBoundary>
		</EditButtonLayout>
	)
}
