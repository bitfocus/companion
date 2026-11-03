import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { LinkButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { LinkButtonRuntimeProps } from '@companion-app/shared/Model/Link.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ControlHotPressButtons } from './ControlHotPressButtons.js'
import { EditButtonLayout } from './EditButtonLayout.js'
import { LinkButtonEditor } from './LinkButtonEditor.js'

interface LinkButtonPanelProps {
	controlId: SomeControlId
	location: ControlLocation
	config: LinkButtonModel
	runtimeProps: LinkButtonRuntimeProps
}

export function LinkButtonPanel({
	controlId,
	location,
	config,
	runtimeProps,
}: LinkButtonPanelProps): React.JSX.Element {
	const setControlNotes = useControlNotesSetter(controlId)
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)

	return (
		<EditButtonLayout
			controlId={controlId}
			location={location}
			typeLabel="Remote button"
			// The remote button may use rotary actions
			testControls={<ControlHotPressButtons location={location} showRotaries />}
			actions={null}
			notesState={notesState}
			editorTabs={null}
		>
			<MyErrorBoundary>
				<LinkButtonEditor config={config} controlId={controlId} runtimeProps={runtimeProps} />
			</MyErrorBoundary>
		</EditButtonLayout>
	)
}
