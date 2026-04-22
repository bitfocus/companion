import { observer } from 'mobx-react-lite'
import { useCallback, useEffect, useState } from 'react'
import { TextInputField } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

interface ImageDescriptionEditorProps {
	id: string
	imageName: string
	currentName: string
}

export const ImageDescriptionEditor = observer(function ImageDescriptionEditor({
	imageName,
	currentName,
}: ImageDescriptionEditorProps) {
	const setDescriptionMutation = useMutationExt(trpc.imageLibrary.setDescription.mutationOptions())

	const [localValue, setLocalValue] = useState(currentName)

	// Sync when the server value changes (e.g. switching images)
	useEffect(() => {
		setLocalValue(currentName)
	}, [currentName])

	const commitToServer = useCallback(() => {
		setDescriptionMutation.mutateAsync({ imageName, description: localValue }).catch((err) => {
			console.error('Failed to save image description:', err)
		})
	}, [setDescriptionMutation, imageName, localValue])

	return (
		<TextInputField
			// id={id}
			value={localValue}
			setValue={setLocalValue}
			onBlur={commitToServer}
			placeholder="Enter image description..."
		/>
	)
})
