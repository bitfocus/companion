import { humanId } from 'human-id'
import { nanoid } from 'nanoid'
import { useCallback, useContext } from 'react'
import type { NotificationsManagerRef } from '~/Components/Notifications.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useImageLibraryUpload } from './useImageLibraryUpload'

/** Above this many files, a progress toast is shown while uploading */
export const UPLOAD_PROGRESS_THRESHOLD = 3

function pluralImages(count: number): string {
	return `${count} image${count === 1 ? '' : 's'}`
}

/**
 * Imports each image file into the library in turn, reporting the outcome through the notifier. Larger batches get
 * a toast that counts up as they go, and is then replaced by the result.
 */
export async function uploadImageFiles(
	files: File[],
	uploadOne: (file: File) => Promise<void>,
	notifier: Pick<NotificationsManagerRef, 'show'>
): Promise<void> {
	const imageFiles = files.filter((file) => file.type.startsWith('image/'))
	if (imageFiles.length === 0) {
		notifier.show('Invalid Files', 'Please choose image files only', 5000)
		return
	}

	const toastId = nanoid()
	const showProgress = imageFiles.length > UPLOAD_PROGRESS_THRESHOLD
	const reportProgress = (completed: number) =>
		notifier.show('Uploading images...', `${completed} of ${imageFiles.length} done`, null, toastId)

	let completed = 0
	try {
		if (showProgress) reportProgress(completed)

		for (const file of imageFiles) {
			await uploadOne(file)

			completed++
			if (showProgress) reportProgress(completed)
		}

		notifier.show('Upload Complete', `Successfully uploaded ${pluralImages(imageFiles.length)}`, 5000, toastId)
	} catch (err) {
		console.error('Failed to import images:', err)
		notifier.show(
			'Upload Failed',
			`Failed to upload one or more images (${completed} of ${imageFiles.length} uploaded)`,
			5000,
			toastId
		)
	}
}

/** Returns a function that imports image files into the library as new images */
export function useUploadImageFiles(): (files: File[]) => Promise<void> {
	const { notifier } = useContext(RootAppStoreContext)
	const createMutation = useMutationExt(trpc.imageLibrary.create.mutationOptions())
	const { uploadImageFile } = useImageLibraryUpload()

	return useCallback(
		async (files: File[]) =>
			uploadImageFiles(
				files,
				async (file) => {
					const imageName = humanId({ separator: '-', capitalize: false })

					// Create the image placeholder first
					const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
					await createMutation.mutateAsync({
						name: imageName,
						description: fileName || imageName,
					})

					// Then upload the file
					await uploadImageFile(file, imageName)
				},
				notifier
			),
		[createMutation, uploadImageFile, notifier]
	)
}
