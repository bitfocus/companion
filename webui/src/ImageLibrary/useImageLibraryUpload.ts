import { useCallback } from 'react'
import { base64EncodeUint8Array } from '~/Resources/util.js'
import { blobToDataURL } from '~/Helpers/FileUpload.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import CryptoJS from 'crypto-js'

/**
 * Hook for uploading image files to the image library
 */
export function useImageLibraryUpload(): { uploadImageFile: (file: File, imageName: string) => Promise<void> } {
	const startUploadMutation = useMutationExt(trpc.imageLibrary.upload.start.mutationOptions())
	const uploadChunkMutation = useMutationExt(trpc.imageLibrary.upload.uploadChunk.mutationOptions())
	const completeUploadMutation = useMutationExt(trpc.imageLibrary.upload.complete.mutationOptions())

	const uploadImageFile = useCallback(
		async (file: File, imageName: string) => {
			// Convert file to data URL and upload
			const dataUrl = await blobToDataURL(file)
			const data = new TextEncoder().encode(dataUrl)

			const hasher = CryptoJS.algo.SHA1.create()
			hasher.update(CryptoJS.lib.WordArray.create(data))
			const checksum = hasher.finalize().toString(CryptoJS.enc.Hex)

			// Start upload
			const sessionId = await startUploadMutation.mutateAsync({
				name: file.name,
				size: data.byteLength,
			})
			if (!sessionId) throw new Error('Failed to start upload')

			// Upload the file in 1MB chunks
			const CHUNK_SIZE = 1024 * 1024 // 1MB
			const totalChunks = Math.ceil(data.length / CHUNK_SIZE)

			for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
				const start = chunkIndex * CHUNK_SIZE
				const end = Math.min(start + CHUNK_SIZE, data.length)
				const chunk = data.slice(start, end)

				await uploadChunkMutation.mutateAsync({
					sessionId,
					offset: start,
					data: base64EncodeUint8Array(chunk),
				})
			}

			// Complete upload
			await completeUploadMutation.mutateAsync({
				sessionId,
				expectedChecksum: checksum,
				userData: { imageName },
			})
		},
		[startUploadMutation, uploadChunkMutation, completeUploadMutation]
	)

	return { uploadImageFile }
}
