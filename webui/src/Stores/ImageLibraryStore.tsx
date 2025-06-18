import { action, observable } from 'mobx'
import type { ImageLibraryInfo, ImageLibraryCollection } from '@companion-app/shared/Model/ImageLibraryModel.js'

export class ImageLibraryStore {
	readonly store = observable.map<string, ImageLibraryInfo>()
	readonly collections = observable.map<string, ImageLibraryCollection>()

	public reset = action((newData: ImageLibraryInfo[] | null): void => {
		this.store.clear()

		if (newData) {
			for (const image of newData) {
				this.store.set(image.id, image)
			}
		}
	})

	public resetCollections = action((newData: ImageLibraryCollection[] | null): void => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				this.collections.set(collection.id, collection)
			}
		}
	})

	public updateImage = action((imageId: string, imageInfo: ImageLibraryInfo): void => {
		this.store.set(imageId, imageInfo)
	})

	public removeImage = action((imageId: string): void => {
		this.store.delete(imageId)
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
