import { faNoteSticky } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './Notes.css'
import classNames from 'classnames'
import { useCallback, useState } from 'react'
import { Button } from '~/Components/Button.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import type { NotesEditorState } from './useNotesEditor.js'

/** Offers to add a note, while there is none */
export function AddNoteButton({ state }: { state: NotesEditorState }): React.JSX.Element | null {
	if (state.hasNote || state.isEditing) return null

	return (
		<Button color="secondary" variant="ghost" size="sm" className="notes-add" onClick={state.startEditing}>
			<FontAwesomeIcon icon={faNoteSticky} />
			Add note
		</Button>
	)
}

/**
 * The notes at the top of an editor: the start of the note, which expands on click, or the editor while it is
 * being changed. Renders nothing when there is no note.
 */
export function NotesStrip({ state }: { state: NotesEditorState }): React.JSX.Element | null {
	const [expanded, setExpanded] = useState(false)

	const { setNotes, stopEditing } = state
	const clearNote = useCallback(() => {
		setNotes('')
		stopEditing()
	}, [setNotes, stopEditing])

	if (state.isEditing) {
		return (
			<div className="notes-card">
				<div className="notes-heading">
					<span>
						<FontAwesomeIcon icon={faNoteSticky} /> Notes
					</span>
					<div className="notes-actions">
						<Button color="danger" variant="ghost" size="sm" onClick={clearNote}>
							Clear
						</Button>
						<Button color="secondary" variant="ghost" size="sm" onClick={stopEditing}>
							Done
						</Button>
					</div>
				</div>
				<TextInputFieldSimple
					id={undefined}
					value={state.notes ?? ''}
					setValue={setNotes}
					placeholder="Notes..."
					multiline
					autoFocus
					tooltip="Internal notes, for whoever maintains this configuration"
					className="notes-input"
				/>
			</div>
		)
	}

	if (!state.hasNote) return null

	return (
		<div className="notes-preview">
			<FontAwesomeIcon icon={faNoteSticky} className="notes-preview-icon" />
			<button
				type="button"
				className={classNames('notes-preview-text', { 'line-clamp-3': !expanded })}
				onClick={() => setExpanded((value) => !value)}
				title={expanded ? 'Show less' : 'Show all'}
			>
				{state.notes}
			</button>
			<Button color="secondary" variant="ghost" size="sm" onClick={state.startEditing}>
				Edit
			</Button>
		</div>
	)
}

/** The note strip placed between two sections of an edit panel, with the spacing of a section */
export function NotesAfterSection({ state }: { state: NotesEditorState }): React.JSX.Element {
	return (
		<div className="notes-after-section">
			<NotesStrip key={state.ownerId} state={state} />
		</div>
	)
}
