import { useCallback, useState } from 'react'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

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
export function useControlNotesSetter(controlId: string): (notes: string) => void {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	return useCallback(
		(notes: string) => {
			setOptionsFieldMutation.mutateAsync({ controlId, key: 'notes', value: notes }).catch((e) => {
				console.error('Failed to set notes:', e)
			})
		},
		[setOptionsFieldMutation, controlId]
	)
}
