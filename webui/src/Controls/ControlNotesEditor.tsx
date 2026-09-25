import { useCallback } from 'react'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface ControlNotesEditorProps {
	controlId: string
	notes: string | undefined
	className?: string
	id?: string
	multiline?: boolean
	autoFocus?: boolean
}

export function ControlNotesEditor({
	controlId,
	notes,
	className,
	id,
	multiline = true,
	autoFocus,
}: ControlNotesEditorProps): React.JSX.Element {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setNotes = useCallback(
		(value: string) => {
			setOptionsFieldMutation.mutateAsync({ controlId, key: 'notes', value }).catch((e) => {
				console.error('Failed to set notes:', e)
			})
		},
		[setOptionsFieldMutation, controlId]
	)

	return (
		<TextInputFieldSimple
			id={id}
			value={notes ?? ''}
			setValue={setNotes}
			placeholder="Notes..."
			multiline={multiline}
			autoFocus={autoFocus}
			tooltip="Internal notes for this control"
			className={className}
		/>
	)
}
