import { CopyButton } from '~/Components/CopyButton'
import { AddNoteButton } from '~/Controls/Notes.js'
import type { NotesEditorState } from '~/Controls/useNotesEditor.js'

interface VariableReferenceRowProps {
	/** The full reference to the variable, such as `$(custom:name)` */
	reference: string
	notesState: NotesEditorState
}

/** The first row of a variable's edit panel: how to reference it, with a copy button and the offer to add a note */
export function VariableReferenceRow({ reference, notesState }: VariableReferenceRowProps): React.JSX.Element {
	return (
		<div className="edit-field-row">
			<span className="text-xs font-semibold text-body">Variable</span>
			<div className="flex items-center gap-1.5 min-w-0">
				<span className="variable-style truncate">{reference}</span>
				<CopyButton size="sm" title="Copy variable name" color="primary" variant="ghost" text={reference} />
				<div className="ms-auto shrink-0">
					<AddNoteButton state={notesState} />
				</div>
			</div>
		</div>
	)
}
