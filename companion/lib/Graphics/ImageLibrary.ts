import crypto from 'crypto'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { MultipartUploader } from '../Resources/MultipartUploader.js'
import LogController from '../Log/Controller.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { UIHandler } from '../UI/Handler.js'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import { makeLabelSafe } from '@companion-app/shared/Label.js'

export interface ImageLibraryData {
	originalImage: string // base64 data URL (empty string if not uploaded yet)
	previewImage: string // base64 data URL (empty string if not uploaded yet)
	info: ImageLibraryInfo
}

export class ImageLibrary {
	readonly #logger = LogController.createLogger('Graphics/ImageLibrary')
	readonly #dbTable: DataStoreTableView<Record<string, ImageLibraryData>>
	readonly #multipartUploader: MultipartUploader
	readonly #io: UIHandler
	readonly #sessionToImageId = new Map<string, string>()

	constructor(dbTable: DataStoreTableView<Record<string, ImageLibraryData>>, io: UIHandler) {
		this.#dbTable = dbTable
		this.#io = io
		this.#multipartUploader = new MultipartUploader((sessionId) => {
			this.#sessionToImageId.delete(sessionId)
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

		// Create new empty image
		client.onPromise('image-library:create', (id: string, name: string) => {
			return this.createEmptyImage(id, name)
		})

		// Set image name
		client.onPromise('image-library:set-name', (imageId: string, name: string) => {
			return this.setImageName(imageId, name)
		})

		// Delete image
		client.onPromise('image-library:delete', (imageId: string) => {
			return this.deleteImage(imageId)
		})

		// Upload handling - simplified upload workflow
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

		client.onPromise('image-library:upload-complete', async (sessionId: string, imageId: string, checksum: string) => {
			this.#logger.debug(`Completing image upload ${sessionId} for image ${imageId}`)

			try {
				const data = this.#multipartUploader.completeSession(sessionId, checksum)
				if (!data) {
					throw new Error('Invalid upload session')
				}

				// Process the uploaded image data and update the existing image
				const imageInfo = await this.#updateImageWithData(imageId, data)

				this.#io.emitToAll('image-library:upload-complete', sessionId, imageId)

				this.#io.emitToRoom('image-library', 'image-library:updated', imageId, imageInfo.info)

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
			this.#sessionToImageId.delete(sessionId)
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
			.sort((a, b) => b.modifiedAt - a.modifiedAt)
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
	getImageDataUrl(imageId: string, type: 'original' | 'preview'): { image: string; checksum: string } | null {
		const data = this.#dbTable.get(imageId)
		if (!data) return null

		return {
			image: type === 'original' ? data.originalImage : data.previewImage,
			checksum: data.info.checksum,
		}
	}

	/**
	 * Delete an image from the library
	 */
	deleteImage(imageId: string): boolean {
		const data = this.#dbTable.get(imageId)
		if (!data) return false

		this.#dbTable.delete(imageId)

		this.#logger.info(`Deleted image ${imageId} (${data.info.name})`)

		this.#io.emitToRoom('image-library', 'image-library:removed', imageId)

		return true
	}

	/**
	 * Create a new empty image entry
	 */
	createEmptyImage(imageId: string, name: string): string {
		// Validate and sanitize the ID
		const safeId = makeLabelSafe(imageId)
		if (!safeId) {
			throw new Error('Invalid image ID')
		}

		// Check if ID already exists
		if (this.#dbTable.get(safeId)) {
			throw new Error(`Image with ID "${safeId}" already exists`)
		}

		const now = Date.now()

		const info: ImageLibraryInfo = {
			id: safeId,
			name: name,
			originalSize: 0,
			previewSize: 0,
			createdAt: now,
			modifiedAt: now,
			checksum: '',
			mimeType: '',
		}

		const imageData: ImageLibraryData = {
			originalImage: '', // Empty until uploaded
			previewImage: '', // Empty until uploaded
			info,
		}

		this.#dbTable.set(safeId, imageData)

		this.#logger.info(`Created empty image ${safeId} (${name})`)

		// Notify clients
		this.#io.emitToRoom('image-library', 'image-library:added', safeId, info)

		return safeId
	}

	/**
	 * Make an image ID unique by appending a number if it already exists
	 */
	makeImageIdUnique(baseId: string): string {
		const safeBaseId = makeLabelSafe(baseId)
		if (!safeBaseId) {
			throw new Error('Invalid base image ID')
		}

		if (!this.#dbTable.get(safeBaseId)) {
			return safeBaseId
		}

		let index = 2
		while (this.#dbTable.get(`${safeBaseId}_${index}`)) {
			index++
		}

		return `${safeBaseId}_${index}`
	}

	/**
	 * Set the name of an existing image
	 */
	setImageName(imageId: string, name: string): boolean {
		const data = this.#dbTable.get(imageId)
		if (!data) return false

		// Update the name and modified timestamp
		data.info.name = name
		data.info.modifiedAt = Date.now()

		this.#dbTable.set(imageId, data)

		this.#logger.info(`Updated image ${imageId} name to "${name}"`)

		// Notify clients
		this.#io.emitToRoom('image-library', 'image-library:updated', imageId, data.info)

		return true
	}

	/**
	 * Update an existing image with uploaded data
	 */
	async #updateImageWithData(imageId: string, data: Buffer): Promise<ImageLibraryData> {
		const existingData = this.#dbTable.get(imageId)
		if (!existingData) {
			throw new Error('Image not found')
		}

		// Parse the data URL from the uploaded buffer
		const dataUrlString = data.toString('utf-8')
		const dataUrlMatch = dataUrlString.match(/^data:([^;]+);base64,(.+)$/)

		if (!dataUrlMatch) {
			throw new Error('Invalid data URL format')
		}

		const mimeType = dataUrlMatch[1]
		const base64Data = dataUrlMatch[2]

		// Validate MIME type
		if (!mimeType.startsWith('image/')) {
			throw new Error('Unsupported image format')
		}

		// Convert base64 to buffer for processing
		const imageBuffer = Buffer.from(base64Data, 'base64')

		// The original data URL is already properly formatted
		const originalImage = dataUrlString

		// Get image dimensions and create preview
		const { width, height, previewData } = await this.#createPreview(imageBuffer)

		// Create preview data URL
		const previewImage = `data:image/jpeg;base64,${previewData.toString('base64')}`

		// Update the existing image info
		existingData.info.originalSize = imageBuffer.length
		existingData.info.previewSize = previewData.length
		existingData.info.modifiedAt = Date.now()
		existingData.info.checksum = crypto.createHash('sha-1').update(imageBuffer).digest('hex')
		existingData.info.mimeType = mimeType

		// Update the image data
		existingData.originalImage = originalImage
		existingData.previewImage = previewImage

		// Store in database
		this.#dbTable.set(imageId, existingData)

		this.#logger.info(
			`Updated image ${imageId} (${existingData.info.name}) - ${width}x${height}, ${imageBuffer.length} bytes`
		)

		return existingData
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
