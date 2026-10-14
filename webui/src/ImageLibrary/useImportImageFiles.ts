import { useCallback } from 'react'
import { useUploadImageFiles } from './useUploadImageFiles'

/** Opens a file picker and imports each chosen image into the library. */
export function useImportImageFiles(): () => void {
	const uploadImageFiles = useUploadImageFiles()

	return useCallback(() => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = 'image/*'
		input.multiple = true

		input.onchange = () => {
			const files = input.files
			if (!files || files.length === 0) return

			void uploadImageFiles(Array.from(files))
		}

		input.click()
	}, [uploadImageFiles])
}
