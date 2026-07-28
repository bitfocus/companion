import { observer } from 'mobx-react-lite'
import { useCallback, useEffect, useState } from 'react'
import { ColorInputField } from '~/Components/ColorInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

interface ImageBackgroundColorEditorProps {
	id: string
	imageName: string
	currentColor: string | undefined
}

// rgba, not the 'transparent' keyword, which the colour picker (colord) can't parse
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

export const ImageBackgroundColorEditor = observer(function ImageBackgroundColorEditor({
	id,
	imageName,
	currentColor,
}: ImageBackgroundColorEditorProps) {
	const setBackgroundColorMutation = useMutationExt(trpc.imageLibrary.setBackgroundColor.mutationOptions())

	const [localValue, setLocalValue] = useState(currentColor ?? TRANSPARENT)

	// Sync when the server value changes (e.g. switching images)
	useEffect(() => {
		setLocalValue(currentColor ?? TRANSPARENT)
	}, [currentColor])

	const setValue = useCallback(
		(value: string) => {
			setLocalValue(value)
			setBackgroundColorMutation.mutateAsync({ imageName, backgroundColor: value }).catch((err) => {
				console.error('Failed to save image background color:', err)
			})
		},
		[setBackgroundColorMutation, imageName]
	)

	return <ColorInputField<'string'> id={id} value={localValue} setValue={setValue} returnType="string" enableAlpha />
})
