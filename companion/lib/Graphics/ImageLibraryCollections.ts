import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'
import type { ImageLibraryCollection } from '@companion-app/shared/Model/ImageLibraryModel.js'

const ImageLibraryCollectionsRoom = 'image-library-collections'

export class ImageLibraryCollections extends CollectionsBaseController<undefined> {
	readonly #io: UIHandler

	readonly #cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void

	constructor(
		io: UIHandler,
		db: DataDatabase,
		cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void
	) {
		super(db.getTableView<Record<string, ImageLibraryCollection>>('image_library_collections'))

		this.#io = io
		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
	}

	/**
	 * Ensure that all collectionIds in images are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdate(rows: ImageLibraryCollection[]): void {
		this.#io.emitToRoom(ImageLibraryCollectionsRoom, 'image-library-collections:update', rows)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('image-library-collections:subscribe', () => {
			client.join(ImageLibraryCollectionsRoom)

			return this.data
		})

		client.onPromise('image-library-collections:unsubscribe', () => {
			client.leave(ImageLibraryCollectionsRoom)
		})

		client.onPromise('image-library-collections:add', (collectionName: string) => {
			return this.collectionCreate(
				collectionName,
				undefined // No metadata for image library collections
			)
		})

		client.onPromise('image-library-collections:remove', this.collectionRemove)
		client.onPromise('image-library-collections:set-name', this.collectionSetName)
		client.onPromise('image-library-collections:reorder', this.collectionMove)
	}
}
