import { formatLocation, type SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { AddNoteButton, NotesStrip } from '~/Controls/Notes.js'
import type { NotesEditorState } from '~/Controls/useNotesEditor.js'
import { useButtonImageForControlId } from '~/Hooks/useButtonImageForControlId.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ButtonEditorTabBar } from './ButtonEditorTabs.js'
import { ControlClearButton } from './ControlClearButton.js'
import type { ButtonEditorMainTabState } from './useButtonEditorMainTab.js'

interface EditButtonLayoutProps {
	controlId: SomeControlId
	location: ControlLocation
	typeLabel: string
	/** Controls to test the button with, for types that can be pressed */
	testControls: React.ReactNode
	/** Extra actions, shown before the clear button */
	actions: React.ReactNode
	/** For types that have notes */
	notesState: NotesEditorState | null
	/** For types whose editor has tabs. The bar sits in the summary card, so it stays sticky with it */
	editorTabs: ButtonEditorMainTabState | null
	children: React.ReactNode
}

/** The summary card and notes shared by every button type, above the type's own editor */
export function EditButtonLayout({
	controlId,
	location,
	typeLabel,
	testControls,
	actions,
	notesState,
	editorTabs,
	children,
}: EditButtonLayoutProps): React.JSX.Element {
	const previewImage = useButtonImageForControlId(controlId)

	return (
		<>
			<div className="edit-button-sticky-header">
				<div className="edit-button-summary">
					<div className="edit-button-summary-preview">
						<ButtonPreviewBase fixedSize={100} preview={previewImage} />
					</div>
					<div className="edit-button-summary-identity">
						<strong>Button {formatLocation(location)}</strong>
						<span>{typeLabel}</span>
						{testControls && (
							<div className="edit-button-summary-test">
								<MyErrorBoundary>{testControls}</MyErrorBoundary>
							</div>
						)}
					</div>
					<div className="edit-button-summary-actions">
						<MyErrorBoundary>
							{notesState && <AddNoteButton state={notesState} />}
							{actions}
							<ControlClearButton location={location} />
						</MyErrorBoundary>
					</div>
					{editorTabs && (
						<div className="edit-button-summary-tabs">
							<ButtonEditorTabBar {...editorTabs} />
						</div>
					)}
				</div>

				{notesState && (
					<MyErrorBoundary>
						<NotesStrip key={controlId} state={notesState} />
					</MyErrorBoundary>
				)}
			</div>

			{children}
		</>
	)
}
