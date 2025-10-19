import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'

export interface GenericCollectionsStore<T> {
	resetCollections: (newData: CollectionBase<T>[] | null) => void

	rootCollections(): CollectionBase<T>[]
}
