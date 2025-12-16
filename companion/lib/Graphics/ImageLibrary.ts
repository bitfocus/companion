import crypto from 'crypto'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { MultipartUploader } from '../Resources/MultipartUploader.js'
import LogController from '../Log/Controller.js'
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
import type { VariableDefinitionTmp } from '../Instance/Connection/ChildHandler.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import EventEmitter from 'node:events'

const MAX_IMPORT_FILE_SIZE = 1024 * 1024 * 10 // 10MB limit, just in case

export interface ImageLibraryData {
	originalImage: string // base64 data URL (empty string if not uploaded yet)
	previewImage: string // base64 data URL (empty string if not uploaded yet)
	info: ImageLibraryInfo
}

export class ImageLibrary {
	readonly #logger = LogController.createLogger('Graphics/ImageLibrary')
	readonly #dbTable: DataStoreTableView<Record<string, ImageLibraryData>>
	readonly #multipartUploader: MultipartUploader<string, { imageName: string }>
	readonly #graphicsController: GraphicsController
	readonly #variablesController: VariablesController
	readonly #collections: ImageLibraryCollections

	readonly #events = new EventEmitter<{ update: [ImageLibraryUpdate[]] }>()

	constructor(db: DataDatabase, graphicsController: GraphicsController, variablesController: VariablesController) {
		this.#dbTable = db.getTableView('image_library')
		this.#graphicsController = graphicsController
		this.#variablesController = variablesController
		this.#collections = new ImageLibraryCollections(db, (validCollectionIds) =>
			this.#cleanUnknownCollectionIds(validCollectionIds)
		)
		this.#multipartUploader = new MultipartUploader(
			'Graphics/ImageLibrary',
			MAX_IMPORT_FILE_SIZE,
			async (_name, data, userData) => {
				// Process the uploaded image data and update the existing image
				const imageInfo = await this.#updateImageWithData(userData.imageName, data)

				this.#events.emit('update', [{ type: 'update', itemName: userData.imageName, info: imageInfo.info }])

				return userData.imageName
			}
		)

		this.#events.setMaxListeners(0)

		this.#cleanUnknownCollectionIds(this.#collections.collectAllCollectionIds())

		// Initialize variables for existing images
		this.#updateAllImageVariables()
	}

	#cleanUnknownCollectionIds(validCollectionIds: ReadonlySet<string>): void {
		const changes: ImageLibraryUpdate[] = []

		for (const [name, data] of Object.entries(this.#dbTable.all())) {
			if (!data.info.collectionId) continue

			if (validCollectionIds.has(data.info.collectionId)) continue

			data.info.collectionId = undefined
			this.#dbTable.set(name, data)

			changes.push({ type: 'update', itemName: name, info: data.info })
		}

		if (this.#events.listenerCount('update') > 0 && changes.length > 0) {
			this.#events.emit('update', changes)
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			collections: this.#collections.createTrpcRouter(),
			upload: this.#multipartUploader.createTrpcRouter(),

			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'update', signal)

				yield [{ type: 'init', images: self.listImages() }] satisfies ImageLibraryUpdate[]

				for await (const [change] of changes) {
					yield change
				}
			}),

			create: publicProcedure
				.input(
					z.object({
						name: z.string(),
						description: z.string(),
					})
				)
				.mutation(({ input }) => {
					return this.createEmptyImage(input.name, input.description)
				}),
			delete: publicProcedure
				.input(
					z.object({
						imageName: z.string(),
					})
				)
				.mutation(({ input }) => {
					return this.deleteImage(input.imageName)
				}),

			reorder: publicProcedure
				.input(
					z.object({
						collectionId: z.string().nullable(),
						imageName: z.string(),
						dropIndex: z.number(),
					})
				)
				.mutation(({ input }) => {
					return this.setImageOrder(input.collectionId, input.imageName, input.dropIndex)
				}),

			getData: publicProcedure
				.input(
					z.object({
						imageName: z.string(),
						type: z.enum(['original', 'preview']),
					})
				)
				.query(({ input }) => {
					return this.getImageDataUrl(input.imageName, input.type)
				}),

			setDescription: publicProcedure
				.input(
					z.object({
						imageName: z.string(),
						description: z.string(),
					})
				)
				.mutation(({ input }) => {
					return this.setImageDescription(input.imageName, input.description)
				}),

			setName: publicProcedure
				.input(
					z.object({
						imageName: z.string(),
						newName: z.string(),
					})
				)
				.mutation(({ input }) => {
					return this.setImageName(input.imageName, input.newName)
				}),
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
	getImageInfo(imageName: string): ImageLibraryInfo | null {
		const data = this.#dbTable.get(imageName)
		return data?.info || null
	}

	/**
	 * Get image data as base64 data URL
	 */
	getImageDataUrl(imageName: string, type: 'original' | 'preview'): { image: string; checksum: string } | null {
		const data = this.#dbTable.get(imageName)
		if (!data) return null

		return {
			image: type === 'original' ? data.originalImage : data.previewImage,
			checksum: data.info.checksum,
		}
	}

	/**
	 * Delete an image from the library
	 */
	deleteImage(imageName: string): boolean {
		const data = this.#dbTable.get(imageName)
		if (!data) return false

		this.#dbTable.delete(imageName)

		this.#logger.info(`Deleted image ${imageName} (${data.info.name})`)

		this.#events.emit('update', [{ type: 'remove', itemName: imageName }])

		// Remove variable for the deleted image
		this.#removeImageVariable(imageName)

		return true
	}

	/**
	 * Create a new empty image entry
	 */
	createEmptyImage(name: string, description: string): string {
		// Validate and sanitize the name
		const sageName = makeLabelSafe(name)
		if (!sageName) {
			throw new Error('Invalid image name')
		}

		// Check if name already exists
		if (this.#dbTable.get(sageName)) {
			throw new Error(`Image with name "${sageName}" already exists`)
		}

		const now = Date.now()

		const info: ImageLibraryInfo = {
			name: sageName,
			description: description,
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

		this.#dbTable.set(sageName, imageData)

		// Create variable for the new image
		this.#updateImageVariable(sageName, imageData.originalImage)

		// Update variable definitions
		this.#updateImageVariableDefinitions()

		this.#logger.info(`Created empty image ${sageName} (${description})`)

		// Notify clients
		this.#events.emit('update', [{ type: 'update', itemName: sageName, info }])

		return sageName
	}

	/**
	 * Make an image name unique by appending a number if it already exists
	 */
	makeImageNameUnique(baseName: string): string {
		const safeBaseName = makeLabelSafe(baseName)
		if (!safeBaseName) {
			throw new Error('Invalid base image name')
		}

		if (!this.#dbTable.get(safeBaseName)) {
			return safeBaseName
		}

		let index = 2
		while (this.#dbTable.get(`${safeBaseName}_${index}`)) {
			index++
		}

		return `${safeBaseName}_${index}`
	}

	/**
	 * Set the name of an existing image
	 */
	setImageDescription(name: string, description: string): boolean {
		const data = this.#dbTable.get(name)
		if (!data) return false

		// Update the description and modified timestamp
		data.info.description = description
		data.info.modifiedAt = Date.now()

		this.#dbTable.set(name, data)

		// Update variable definitions since the name is used as the label
		this.#updateImageVariableDefinitions()

		this.#logger.info(`Updated image ${name} description to "${description}"`)

		// Notify clients
		this.#events.emit('update', [{ type: 'update', itemName: name, info: data.info }])

		return true
	}

	/**
	 * Set the name of an existing image
	 */
	setImageName(currentName: string, newName: string): string {
		const data = this.#dbTable.get(currentName)
		if (!data) {
			throw new Error(`Image with name "${currentName}" not found`)
		}

		// Validate and sanitize the new name
		const safeNewName = makeLabelSafe(newName)
		if (!safeNewName) {
			throw new Error('Invalid image name')
		}

		// Check if new ID already exists and is different from current
		if (safeNewName !== currentName && this.#dbTable.get(safeNewName)) {
			throw new Error(`Image with name "${safeNewName}" already exists`)
		}

		// If the name is the same, no change needed
		if (safeNewName === currentName) return safeNewName

		// Update the name in the info
		data.info.name = safeNewName
		data.info.modifiedAt = Date.now()

		// Move the data to the new key and delete the old one
		this.#dbTable.set(safeNewName, data)
		this.#dbTable.delete(currentName)

		// Update variables: remove old and add new
		this.#removeImageVariable(currentName)
		this.#updateImageVariable(safeNewName, data.originalImage)

		// Update variable definitions
		this.#updateImageVariableDefinitions()

		this.#logger.info(`Updated image name from "${currentName}" to "${safeNewName}"`)

		// Notify clients of the removal of the old name and addition of the new one
		this.#events.emit('update', [
			{ type: 'remove', itemName: currentName },
			{ type: 'update', itemName: safeNewName, info: data.info },
		])

		return safeNewName
	}

	/**
	 * Set the order of an image within a collection
	 */
	setImageOrder(collectionId: string | null, imageName: string, dropIndex: number): void {
		const imageData = this.#dbTable.get(imageName)
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
					imgId !== imageName && ((!data.info.collectionId && !collectionId) || data.info.collectionId === collectionId)
			)
			.sort(([, a], [, b]) => (a.info.sortOrder || 0) - (b.info.sortOrder || 0))

		if (dropIndex < 0) {
			// Push the image to the end of the array
			sortedImages.push([imageName, imageData])
		} else {
			// Insert the image at the drop index
			sortedImages.splice(dropIndex, 0, [imageName, imageData])
		}

		const changes: ImageLibraryUpdate[] = []

		// update the sort order of the images in the store, tracking which ones changed
		sortedImages.forEach(([name, data], index) => {
			if (data.info.sortOrder === index && name !== imageName) return // No change

			data.info.sortOrder = index // Update the sort order
			data.info.modifiedAt = Date.now()
			this.#dbTable.set(name, data)

			changes.push({ type: 'update', itemName: name, info: data.info })
		})

		if (this.#events.listenerCount('update') > 0 && changes.length > 0) {
			this.#events.emit('update', changes)
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
	async #updateImageWithData(imageName: string, data: Buffer): Promise<ImageLibraryData> {
		const existingData = this.#dbTable.get(imageName)
		if (!existingData) {
			throw new Error('Image not found')
		}

		// Parse the data URL from the uploaded buffer
		const dataUrlString = data.toString('utf-8')

		const dataUrlMatch = dataUrlString.match(/^data:(image\/[\w+]+);base64,(.+)$/)
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
		this.#dbTable.set(imageName, existingData)

		this.#logger.info(`Updated image ${imageName} - ${width}x${height}, ${dataUrlString.length} bytes`)

		// Update the variable for the image
		this.#updateImageVariable(imageName, dataUrlString)

		return existingData
	}

	/**
	 * Update variables for all images in the library
	 */
	#updateAllImageVariables(): void {
		const variables: VariableValueEntry[] = []

		for (const [imageName, data] of Object.entries(this.#dbTable.all())) {
			variables.push({
				id: imageName,
				value: data.originalImage || '',
			})
		}

		this.#variablesController.values.setVariableValues('image', variables)
		this.#updateImageVariableDefinitions()
	}

	/**
	 * Update variable for a specific image
	 */
	#updateImageVariable(imageName: string, originalImage: string): void {
		this.#variablesController.values.setVariableValues('image', [
			{
				id: imageName,
				value: originalImage || '',
			},
		])
	}

	/**
	 * Update variable definitions for all images
	 */
	#updateImageVariableDefinitions(): void {
		const definitions: VariableDefinitionTmp[] = []

		for (const [imageName, data] of Object.entries(this.#dbTable.all())) {
			definitions.push({
				name: imageName,
				label: data.info.description || imageName,
			})
		}

		this.#variablesController.definitions.setVariableDefinitions('image', definitions)
	}

	/**
	 * Get variable definitions for all images
	 */
	getVariableDefinitions(): VariableDefinitionTmp[] {
		const definitions: VariableDefinitionTmp[] = []

		for (const [imageName, data] of Object.entries(this.#dbTable.all())) {
			definitions.push({
				name: imageName,
				label: data.info.description || imageName,
			})
		}

		return definitions
	}

	/**
	 * Remove variable for a specific image
	 */
	#removeImageVariable(imageName: string): void {
		this.#variablesController.values.setVariableValues('image', [
			{
				id: imageName,
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
		this.resetImageLibrary()

		this.#collections.replaceCollections(collections)

		// Import new images with full image data
		for (const imageData of images) {
			const fullImageData: ImageLibraryData = {
				originalImage: imageData.originalImage,
				previewImage: imageData.previewImage,
				info: { ...imageData.info },
			}

			this.#dbTable.set(imageData.info.name, fullImageData)
			this.#logger.info(`Imported image ${imageData.info.name} with image data`)
		}

		// Update variables for imported images
		this.#updateAllImageVariables()

		// Notify clients
		if (this.#events.listenerCount('update') > 0 && images.length > 0) {
			const changes: ImageLibraryUpdate[] = images.map((imageData) => ({
				type: 'update',
				itemName: imageData.info.name,
				info: imageData.info,
			}))
			this.#events.emit('update', changes)
		}

		this.#cleanUnknownCollectionIds(this.#collections.collectAllCollectionIds())
	}

	/**
	 * Reset the entire image library (clear all images and collections)
	 */
	resetImageLibrary(): void {
		// Get all images before clearing
		const allImages = Object.keys(this.#dbTable.all())

		if (allImages.length > 0) {
			// Clear all images from database
			const changes: ImageLibraryUpdate[] = []
			const variables: VariableValueEntry[] = []

			for (const imageName of allImages) {
				this.#dbTable.delete(imageName)
				changes.push({ type: 'remove', itemName: imageName })
				variables.push({ id: imageName, value: undefined })

				this.#logger.info(`Deleted image ${imageName}`)
			}

			this.#variablesController.values.setVariableValues('image', variables)

			// Update variable definitions once
			this.#updateImageVariableDefinitions()

			// Notify clients with batched changes
			this.#events.emit('update', changes)
		}

		// Clear all collections
		this.#collections.discardAllCollections()
	}
}
