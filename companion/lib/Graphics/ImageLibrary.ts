import { nanoid } from 'nanoid'
import crypto from 'crypto'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { MultipartUploader } from '../Resources/MultipartUploader.js'
import LogController from '../Log/Controller.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { UIHandler } from '../UI/Handler.js'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'

export interface ImageLibraryData {
	originalImage: string // base64 data URL
	previewImage: string // base64 data URL
	info: ImageLibraryInfo
}

export class ImageLibrary {
	readonly #logger = LogController.createLogger('Graphics/ImageLibrary')
	readonly #dbTable: DataStoreTableView<Record<string, ImageLibraryData>>
	readonly #multipartUploader: MultipartUploader
	readonly #io: UIHandler

	constructor(dbTable: DataStoreTableView<Record<string, ImageLibraryData>>, io: UIHandler) {
		this.#dbTable = dbTable
		this.#io = io
		this.#multipartUploader = new MultipartUploader((sessionId) => {
			this.#io.emitToAll('image-library:upload-cancelled', sessionId)
		})
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		// Subscribe to image library updates
		client.onPromise('image-library:subscribe', () => {
			client.join('image-library')
			return this.listImages()
		})

		client.onPromise('image-library:unsubscribe', () => {
			client.leave('image-library')
		})

		// List all images
		client.onPromise('image-library:list', () => {
			return this.listImages()
		})

		// Get image info
		client.onPromise('image-library:get-info', (imageId: string) => {
			return this.getImageInfo(imageId)
		})

		// Get image data (original or preview)
		client.onPromise('image-library:get-data', (imageId: string, type: 'original' | 'preview') => {
			return this.getImageDataUrl(imageId, type)
		})

		// Delete image
		client.onPromise('image-library:delete', (imageId: string) => {
			return this.deleteImage(imageId)
		})

		// Upload handling
		client.onPromise('image-library:upload-start', (filename: string, size: number) => {
			this.#logger.debug(`Starting image upload: ${filename} (${size} bytes)`)

			if (size > 50 * 1024 * 1024) {
				// 50MB limit
				throw new Error('File too large (max 50MB)')
			}

			const sessionId = this.#multipartUploader.initSession(filename, size)
			if (!sessionId) {
				throw new Error('Upload session already in progress')
			}

			this.#io.emitToAll('image-library:upload-progress', sessionId, 0)
			return sessionId
		})

		client.onPromise('image-library:upload-chunk', (sessionId: string, offset: number, data: Uint8Array) => {
			this.#logger.silly(`Upload chunk ${sessionId} (@${offset} = ${data.length} bytes)`)

			const progress = this.#multipartUploader.addChunk(sessionId, offset, data)
			if (progress === null) return false

			this.#io.emitToAll('image-library:upload-progress', sessionId, progress)
			return true
		})

		client.onPromise('image-library:upload-complete', async (sessionId: string, checksum: string) => {
			this.#logger.debug(`Completing image upload ${sessionId}`)

			try {
				const data = this.#multipartUploader.completeSession(sessionId, checksum)
				if (!data) {
					throw new Error('Invalid upload session')
				}

				// Process the uploaded image
				const imageId = await this.#processUploadedImage(data)

				this.#io.emitToAll('image-library:upload-complete', sessionId, imageId)
				const imageInfo = this.getImageInfo(imageId)
				if (imageInfo) {
					this.#io.emitToRoom('image-library', 'image-library:added', imageId, imageInfo)
				}

				return imageId
			} catch (error) {
				this.#logger.error(`Image upload failed: ${error}`)
				this.#io.emitToAll(
					'image-library:upload-error',
					sessionId,
					error instanceof Error ? error.message : 'Unknown error'
				)
				throw error
			}
		})

		client.onPromise('image-library:upload-cancel', (sessionId: string) => {
			this.#logger.debug(`Cancelling image upload ${sessionId}`)
			this.#multipartUploader.cancelSession(sessionId)
		})
	}

	/**
	 * List all images in the library
	 */
	listImages(): ImageLibraryInfo[] {
		const allData = this.#dbTable.all()
		return Object.values(allData)
			.map((data) => data.info)
			.sort((a, b) => b.uploadedAt - a.uploadedAt)
	}

	/**
	 * Get image info by ID
	 */
	getImageInfo(imageId: string): ImageLibraryInfo | null {
		const data = this.#dbTable.get(imageId)
		return data?.info || null
	}

	/**
	 * Get image data as base64 data URL
	 */
	getImageDataUrl(imageId: string, type: 'original' | 'preview'): string | null {
		const data = this.#dbTable.get(imageId)
		if (!data) return null

		return type === 'original' ? data.originalImage : data.previewImage
	}

	/**
	 * Delete an image from the library
	 */
	deleteImage(imageId: string): boolean {
		const data = this.#dbTable.get(imageId)
		if (!data) return false

		this.#dbTable.delete(imageId)
		this.#io.emitToRoom('image-library', 'image-library:removed', imageId)

		this.#logger.info(`Deleted image ${imageId} (${data.info.filename})`)
		return true
	}

	/**
	 * Process uploaded image data and create preview
	 */
	async #processUploadedImage(data: Buffer): Promise<string> {
		const imageId = nanoid()

		// Determine MIME type from buffer
		const mimeType = this.#detectMimeType(data)
		if (!mimeType) {
			throw new Error('Unsupported image format')
		}

		// Create original data URL
		const originalImage = `data:${mimeType};base64,${data.toString('base64')}`

		// Get image dimensions and create preview
		const { width, height, previewData } = await this.#createPreview(data)

		// Create preview data URL
		const previewImage = `data:image/jpeg;base64,${previewData.toString('base64')}`

		// Create image info
		const info: ImageLibraryInfo = {
			id: imageId,
			filename: `image_${Date.now()}`, // Could be enhanced to use original filename
			originalSize: data.length,
			previewSize: previewData.length,
			uploadedAt: Date.now(),
			checksum: crypto.createHash('sha-1').update(data).digest('hex'),
			mimeType,
			width,
			height,
		}

		// Store in database
		const imageData: ImageLibraryData = {
			originalImage,
			previewImage,
			info,
		}

		this.#dbTable.set(imageId, imageData)

		this.#logger.info(`Processed image ${imageId} (${info.filename}) - ${width}x${height}, ${data.length} bytes`)

		return imageId
	}

	/**
	 * Detect MIME type from buffer header
	 */
	#detectMimeType(buffer: Buffer): string | null {
		// PNG signature
		if (
			buffer.length >= 8 &&
			buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		) {
			return 'image/png'
		}

		// JPEG signature
		if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
			return 'image/jpeg'
		}

		// GIF signature
		if (
			buffer.length >= 6 &&
			(buffer.subarray(0, 6).equals(Buffer.from('GIF87a')) || buffer.subarray(0, 6).equals(Buffer.from('GIF89a')))
		) {
			return 'image/gif'
		}

		// WebP signature
		if (
			buffer.length >= 12 &&
			buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
			buffer.subarray(8, 12).equals(Buffer.from('WEBP'))
		) {
			return 'image/webp'
		}

		return null
	}

	/**
	 * Create a 200px preview JPEG from the original image
	 */
	async #createPreview(originalData: Buffer): Promise<{ width: number; height: number; previewData: Buffer }> {
		try {
			// Use the @napi-rs/canvas library for image processing
			const { loadImage } = await import('@napi-rs/canvas')

			// Load the original image data
			const originalImage = await loadImage(originalData)

			// Get original dimensions
			const originalWidth = originalImage.width
			const originalHeight = originalImage.height

			// Calculate preview dimensions (max 200px on longest side)
			const maxSize = 200
			let previewWidth: number
			let previewHeight: number

			if (originalWidth > originalHeight) {
				previewWidth = Math.min(maxSize, originalWidth)
				previewHeight = Math.round((originalHeight * previewWidth) / originalWidth)
			} else {
				previewHeight = Math.min(maxSize, originalHeight)
				previewWidth = Math.round((originalWidth * previewHeight) / originalHeight)
			}

			// Create preview canvas
			const { Canvas } = await import('@napi-rs/canvas')
			const canvas = new Canvas(previewWidth, previewHeight)
			const ctx = canvas.getContext('2d')

			// Draw resized image
			ctx.drawImage(originalImage, 0, 0, previewWidth, previewHeight)

			// Convert to JPEG buffer
			const previewData = canvas.toBuffer('image/jpeg', 0.8)

			return {
				width: originalWidth,
				height: originalHeight,
				previewData,
			}
		} catch (error) {
			this.#logger.error(`Failed to create preview: ${error}`)
			throw new Error('Failed to process image')
		}
	}
}
