import { useCallback, useState } from 'react'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ControlTypeWithOptions } from '@companion-app/shared/Model/Controls.js'
import { useControlOptionsSetter } from './useControlOptionsSetter.js'

export interface NotesEditorState {
	/** Whatever the notes belong to (a control, a custom variable), so switching to another closes the editor */
	ownerId: string
	notes: string | undefined
	setNotes: (notes: string) => void
	hasNote: boolean
	isEditing: boolean
	startEditing: () => void
	stopEditing: () => void
}

/**
 * The internal notes of something being edited, shared between the "Add note" button and the strip that shows them.
 */
export function useNotesEditor(
	ownerId: string,
	notes: string | undefined,
	setNotes: (notes: string) => void
): NotesEditorState {
	const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null)

	const startEditing = useCallback(() => setEditingOwnerId(ownerId), [ownerId])
	const stopEditing = useCallback(() => setEditingOwnerId(null), [])

	return {
		ownerId,
		notes,
		setNotes,
		hasNote: !!notes?.trim(),
		isEditing: editingOwnerId === ownerId,
		startEditing,
		stopEditing,
	}
}

/** Saves the notes of a control (a button, trigger or expression variable) */
export function useControlNotesSetter(
	controlId: SomeControlId,
	controlType: ControlTypeWithOptions
): (notes: string) => void {
	const setOption = useControlOptionsSetter(controlId, controlType)

	return useCallback(
		(notes: string) => {
			setOption('notes', notes).catch((e) => {
				console.error('Failed to set notes:', e)
			})
		},
		[setOption]
	)
}
