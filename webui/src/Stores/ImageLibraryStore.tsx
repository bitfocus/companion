import { action, observable } from 'mobx'
import type {
	ImageLibraryInfo,
	ImageLibraryCollection,
	ImageLibraryUpdate,
} from '@companion-app/shared/Model/ImageLibraryModel.js'
import { assertNever } from '~/Resources/util'

export class ImageLibraryStore {
	readonly store = observable.map<string, ImageLibraryInfo>()
	readonly collections = observable.map<string, ImageLibraryCollection>()

	public resetCollections = action((newData: ImageLibraryCollection[] | null): void => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				this.collections.set(collection.id, collection)
			}
		}
	})

	public updateStore = action((changes: ImageLibraryUpdate[] | null): void => {
		if (!changes) {
			this.store.clear()
			return
		}

		for (const change of changes) {
			switch (change.type) {
				case 'init':
					this.store.clear()
					for (const image of change.images) {
						this.store.set(image.name, image)
					}
					break
				case 'update':
					this.store.set(change.itemName, change.info)
					break
				case 'remove':
					this.store.delete(change.itemName)
					break
				default:
					assertNever(change)
			}
		}
	})

	public getImage(imageId: string): ImageLibraryInfo | undefined {
		return this.store.get(imageId)
	}

	public getAllImages(): ImageLibraryInfo[] {
		return Array.from(this.store.values()).sort((a, b) => b.modifiedAt - a.modifiedAt)
	}

	public get count(): number {
		return this.store.size
	}

	public rootImageCollections(): ImageLibraryCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}
}
