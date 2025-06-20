import crypto from 'crypto'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { MultipartUploader } from '../Resources/MultipartUploader.js'
import LogController from '../Log/Controller.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { UIHandler } from '../UI/Handler.js'
import type {
	ImageLibraryInfo,
	ImageLibraryUpdate,
	ImageLibraryCollection,
	ImageLibraryExportData,
} from '@companion-app/shared/Model/ImageLibraryModel.js'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import type { GraphicsController } from './Controller.js'
import { ImageLibraryCollections } from './ImageLibraryCollections.js'
import type { DataDatabase } from '../Data/Database.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { VariableValueEntry } from '../Variables/Values.js'
import type { VariableDefinitionTmp } from '../Instance/Wrapper.js'

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
	readonly #graphicsController: GraphicsController
	readonly #variablesController: VariablesController
	readonly #collections: ImageLibraryCollections

	constructor(
		db: DataDatabase,
		io: UIHandler,
		graphicsController: GraphicsController,
		variablesController: VariablesController
	) {
		this.#dbTable = db.getTableView('image_library')
		this.#io = io
		this.#graphicsController = graphicsController
		this.#variablesController = variablesController
		this.#collections = new ImageLibraryCollections(io, db, (validCollectionIds) =>
			this.#cleanUnknownCollectionIds(validCollectionIds)
		)
		this.#multipartUploader = new MultipartUploader((sessionId) => {
			this.#sessionToImageId.delete(sessionId)
			this.#io.emitToAll('image-library:upload-cancelled', sessionId)
		})

		this.#cleanUnknownCollectionIds(this.#collections.collectAllCollectionIds())

		// Initialize variables for existing images
		this.#updateAllImageVariables()
	}

	#cleanUnknownCollectionIds(validCollectionIds: ReadonlySet<string>): void {
		const changes: ImageLibraryUpdate[] = []

		for (const [id, data] of Object.entries(this.#dbTable.all())) {
			if (!data.info.collectionId) continue

			if (validCollectionIds.has(data.info.collectionId)) continue

			data.info.collectionId = undefined
			this.#dbTable.set(id, data)

			changes.push({ type: 'update', itemId: id, info: data.info })
		}

		if (this.#io.countRoomMembers('image-library') > 0 && changes.length > 0) {
			for (const change of changes) {
				if (change.type === 'update') {
					this.#io.emitToRoom('image-library', 'image-library:updated', change.itemId, change.info)
				}
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.#collections.clientConnect(client)

		client.onPromise('image-library:subscribe', () => {
			client.join('image-library')
			return this.listImages()
		})

		client.onPromise('image-library:unsubscribe', () => {
			client.leave('image-library')
		})

		client.onPromise('image-library:list', () => {
			return this.listImages()
		})

		client.onPromise('image-library:get-data', (imageId: string, type: 'original' | 'preview') => {
			return this.getImageDataUrl(imageId, type)
		})

		client.onPromise('image-library:create', (id: string, name: string) => {
			return this.createEmptyImage(id, name)
		})

		client.onPromise('image-library:set-name', (imageId: string, name: string) => {
			return this.setImageName(imageId, name)
		})

		// Set image ID
		client.onPromise('image-library:set-id', (imageId: string, newId: string) => {
			return this.setImageId(imageId, newId)
		})

		client.onPromise('image-library:delete', (imageId: string) => {
			return this.deleteImage(imageId)
		})

		client.onPromise('image-library:reorder', (collectionId: string | null, imageId: string, dropIndex: number) => {
			return this.setImageOrder(collectionId, imageId, dropIndex)
		})

		client.onPromise('image-library:upload-start', (filename: string, size: number) => {
			this.#logger.debug(`Starting image upload: ${filename} (${size} bytes)`)

			if (size > 10 * 1024 * 1024) {
				// 10MB limit, just in case
				throw new Error('File too large (max 10MB)')
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

		// Remove variable for the deleted image
		this.#removeImageVariable(imageId)

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
			sortOrder: 0, // Will be updated when moved to collections
		}

		const imageData: ImageLibraryData = {
			originalImage: '', // Empty until uploaded
			previewImage: '', // Empty until uploaded
			info,
		}

		this.#dbTable.set(safeId, imageData)

		// Create variable for the new image
		this.#updateImageVariable(safeId, imageData.originalImage)

		// Update variable definitions
		this.#updateImageVariableDefinitions()

		this.#logger.info(`Created empty image ${safeId} (${name})`)

		// Notify clients
		this.#io.emitToRoom('image-library', 'image-library:updated', safeId, info)

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

		// Update variable definitions since the name is used as the label
		this.#updateImageVariableDefinitions()

		this.#logger.info(`Updated image ${imageId} name to "${name}"`)

		// Notify clients
		this.#io.emitToRoom('image-library', 'image-library:updated', imageId, data.info)

		return true
	}

	/**
	 * Set the ID of an existing image
	 */
	setImageId(currentId: string, newId: string): string {
		const data = this.#dbTable.get(currentId)
		if (!data) {
			throw new Error(`Image with ID "${currentId}" not found`)
		}

		// Validate and sanitize the new ID
		const safeNewId = makeLabelSafe(newId)
		if (!safeNewId) {
			throw new Error('Invalid image ID')
		}

		// Check if new ID already exists and is different from current
		if (safeNewId !== currentId && this.#dbTable.get(safeNewId)) {
			throw new Error(`Image with ID "${safeNewId}" already exists`)
		}

		// If the ID is the same, no change needed
		if (safeNewId === currentId) return safeNewId

		// Update the ID in the info
		data.info.id = safeNewId
		data.info.modifiedAt = Date.now()

		// Move the data to the new key and delete the old one
		this.#dbTable.set(safeNewId, data)
		this.#dbTable.delete(currentId)

		// Update variables: remove old and add new
		this.#removeImageVariable(currentId)
		this.#updateImageVariable(safeNewId, data.originalImage)

		// Update variable definitions
		this.#updateImageVariableDefinitions()

		this.#logger.info(`Updated image ID from "${currentId}" to "${safeNewId}"`)

		// Notify clients of the removal of the old ID and addition of the new one
		this.#io.emitToRoom('image-library', 'image-library:removed', currentId)
		this.#io.emitToRoom('image-library', 'image-library:updated', safeNewId, data.info)

		return safeNewId
	}

	/**
	 * Set the order of an image within a collection
	 */
	setImageOrder(collectionId: string | null, imageId: string, dropIndex: number): void {
		const imageData = this.#dbTable.get(imageId)
		if (!imageData) return

		if (!this.#collections.doesCollectionIdExist(collectionId)) return

		// update the collectionId of the image being moved if needed
		if (imageData.info.collectionId !== (collectionId ?? undefined)) {
			imageData.info.collectionId = collectionId ?? undefined
		}

		// find all the other images with the matching collectionId
		const sortedImages = Array.from(Object.entries(this.#dbTable.all()))
			.filter(
				([imgId, data]) =>
					imgId !== imageId && ((!data.info.collectionId && !collectionId) || data.info.collectionId === collectionId)
			)
			.sort(([, a], [, b]) => (a.info.sortOrder || 0) - (b.info.sortOrder || 0))

		if (dropIndex < 0) {
			// Push the image to the end of the array
			sortedImages.push([imageId, imageData])
		} else {
			// Insert the image at the drop index
			sortedImages.splice(dropIndex, 0, [imageId, imageData])
		}

		const changes: ImageLibraryUpdate[] = []

		// update the sort order of the images in the store, tracking which ones changed
		sortedImages.forEach(([id, data], index) => {
			if (data.info.sortOrder === index && id !== imageId) return // No change

			data.info.sortOrder = index // Update the sort order
			data.info.modifiedAt = Date.now()
			this.#dbTable.set(id, data)

			changes.push({ type: 'update', itemId: id, info: data.info })
		})

		if (this.#io.countRoomMembers('image-library') > 0 && changes.length > 0) {
			for (const change of changes) {
				if (change.type === 'update') {
					this.#io.emitToRoom('image-library', 'image-library:updated', change.itemId, change.info)
				}
			}
		}
	}

	/**
	 * Export collections data
	 */
	exportCollections(): ImageLibraryCollection[] {
		return this.#collections.collectionData
	}

	/**
	 * Export full image library data including base64 image content
	 */
	exportImageLibraryData(): ImageLibraryExportData[] {
		const allData = this.#dbTable.all()
		return Object.values(allData)
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

		const dataUrlMatch = dataUrlString.match(/^data:(image\/\w+);base64,(.+)$/)
		if (!dataUrlMatch) {
			throw new Error('Invalid data URL format or unsupported image format')
		}

		// Get image dimensions and create preview
		const { width, height, previewDataUrl } = await this.#graphicsController.executeCreatePreview(dataUrlString)

		// Update the existing image info
		existingData.info.originalSize = dataUrlString.length
		existingData.info.previewSize = previewDataUrl.length
		existingData.info.modifiedAt = Date.now()
		existingData.info.checksum = crypto.createHash('sha-1').update(dataUrlString).digest('hex')
		existingData.info.mimeType = dataUrlMatch[1]

		// Update the image data
		existingData.originalImage = dataUrlString
		existingData.previewImage = previewDataUrl

		// Store in database
		this.#dbTable.set(imageId, existingData)

		this.#logger.info(
			`Updated image ${imageId} (${existingData.info.name}) - ${width}x${height}, ${dataUrlString.length} bytes`
		)

		// Update the variable for the image
		this.#updateImageVariable(imageId, dataUrlString)

		return existingData
	}

	/**
	 * Update variables for all images in the library
	 */
	#updateAllImageVariables(): void {
		const variables: VariableValueEntry[] = []

		for (const [imageId, data] of Object.entries(this.#dbTable.all())) {
			variables.push({
				id: imageId,
				value: data.originalImage || '',
			})
		}

		this.#variablesController.values.setVariableValues('image', variables)
		this.#updateImageVariableDefinitions()
	}

	/**
	 * Update variable for a specific image
	 */
	#updateImageVariable(imageId: string, originalImage: string): void {
		this.#variablesController.values.setVariableValues('image', [
			{
				id: imageId,
				value: originalImage || '',
			},
		])
	}

	/**
	 * Update variable definitions for all images
	 */
	#updateImageVariableDefinitions(): void {
		const definitions: VariableDefinitionTmp[] = []

		for (const [imageId, data] of Object.entries(this.#dbTable.all())) {
			definitions.push({
				name: imageId,
				label: data.info.name || imageId,
			})
		}

		this.#variablesController.definitions.setVariableDefinitions('image', definitions)
	}

	/**
	 * Get variable definitions for all images
	 */
	getVariableDefinitions(): VariableDefinitionTmp[] {
		const definitions: VariableDefinitionTmp[] = []

		for (const [imageId, data] of Object.entries(this.#dbTable.all())) {
			definitions.push({
				name: imageId,
				label: data.info.name || imageId,
			})
		}

		return definitions
	}

	/**
	 * Remove variable for a specific image
	 */
	#removeImageVariable(imageId: string): void {
		this.#variablesController.values.setVariableValues('image', [
			{
				id: imageId,
				value: undefined,
			},
		])
		// Update definitions to remove the deleted image
		this.#updateImageVariableDefinitions()
	}

	/**
	 * Import image library data
	 */
	importImageLibrary(collections: ImageLibraryCollection[], images: ImageLibraryExportData[]): void {
		this.#collections.importCollections(collections)

		// Clear existing images first
		const allImages = this.listImages()
		for (const image of allImages) {
			this.deleteImage(image.id)
		}

		// Import new images with full image data
		for (const imageData of images) {
			const fullImageData: ImageLibraryData = {
				originalImage: imageData.originalImage,
				previewImage: imageData.previewImage,
				info: { ...imageData.info },
			}

			this.#dbTable.set(imageData.info.id, fullImageData)
			this.#logger.info(`Imported image ${imageData.info.id} (${imageData.info.name}) with image data`)
		}

		// Update variables for imported images
		this.#updateAllImageVariables()

		// Notify clients
		if (this.#io.countRoomMembers('image-library') > 0) {
			for (const imageData of images) {
				this.#io.emitToRoom('image-library', 'image-library:updated', imageData.info.id, imageData.info)
			}
		}

		this.#cleanUnknownCollectionIds(this.#collections.collectAllCollectionIds())
	}

	/**
	 * Reset the entire image library (clear all images and collections)
	 */
	resetImageLibrary(): void {
		// Clear all images
		const allImages = this.listImages()
		for (const image of allImages) {
			this.deleteImage(image.id)
		}

		// Clear all collections
		this.#collections.importCollections([])
	}
}
