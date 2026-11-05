import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { LayeredButtonModel, NormalButtonRuntimeProps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { ControlHotPressButtons } from './ControlHotPressButtons.js'
import { EditButtonLayout } from './EditButtonLayout.js'
import { LayeredButtonEditor } from './LayeredButtonEditor/LayeredButtonEditor.js'
import { LiveStepLabel } from './LiveStep.js'
import { LayeredButtonExtraTabs, useButtonEditorMainTab } from './useButtonEditorMainTab.js'

interface LayeredButtonPanelProps {
	controlId: SomeControlId
	location: ControlLocation
	config: LayeredButtonModel
	runtimeProps: NormalButtonRuntimeProps
}

export function LayeredButtonPanel({
	controlId,
	location,
	config,
	runtimeProps,
}: LayeredButtonPanelProps): React.JSX.Element {
	const setControlNotes = useControlNotesSetter(controlId, 'button-layered')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)
	const editorTabs = useButtonEditorMainTab(config.steps, LayeredButtonExtraTabs)

	return (
		<EditButtonLayout
			controlId={controlId}
			location={location}
			typeLabel="Regular button"
			liveStep={<LiveStepLabel steps={config.steps} currentStepId={runtimeProps.current_step_id} />}
			testControls={<ControlHotPressButtons location={location} showRotaries={config.options.rotaryActions} />}
			actions={null}
			notesState={notesState}
			editorTabs={editorTabs}
		>
			<LayeredButtonEditor
				config={config}
				controlId={controlId}
				runtimeProps={runtimeProps}
				location={location}
				activeMainTab={editorTabs.activeTab}
			/>
		</EditButtonLayout>
	)
}
