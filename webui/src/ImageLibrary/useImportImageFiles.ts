import { humanId } from 'human-id'
import { useCallback, useContext } from 'react'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useImageLibraryUpload } from './useImageLibraryUpload'

/** Opens a file picker and imports each chosen image into the library. */
export function useImportImageFiles(): () => void {
	const { notifier } = useContext(RootAppStoreContext)
	const createMutation = useMutationExt(trpc.imageLibrary.create.mutationOptions())
	const { uploadImageFile } = useImageLibraryUpload()

	return useCallback(() => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = 'image/*'
		input.multiple = true

		input.onchange = () => {
			const files = input.files
			if (!files || files.length === 0) return

			// Filter for image files only
			const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))

			if (imageFiles.length === 0) {
				notifier.show('Invalid Files', 'Please select image files only', 5000)
				return
			}

			void (async () => {
				try {
					for (const file of imageFiles) {
						// Generate a random ID for the image
						const imageName = humanId({ separator: '-', capitalize: false })

						// Create the image placeholder first
						const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
						await createMutation.mutateAsync({
							name: imageName,
							description: fileName || imageName,
						})

						// Then upload the file
						await uploadImageFile(file, imageName)
					}

					notifier.show(
						'Upload Complete',
						`Successfully uploaded ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''}`,
						5000
					)
				} catch (err) {
					console.error('Failed to import images:', err)
					notifier.show('Upload Failed', 'Failed to upload one or more images', 5000)
				}
			})()
		}

		input.click()
	}, [createMutation, uploadImageFile, notifier])
}
