import type { CollectionBase } from './Collections.js'

export interface ImageLibraryInfo {
	id: string
	name: string
	originalSize: number
	previewSize: number
	createdAt: number
	modifiedAt: number
	checksum: string
	mimeType: string
	collectionId?: string
	sortOrder: number
}

export type ImageLibraryCollection = CollectionBase<undefined>

export type ImageLibraryUpdate = ImageLibraryUpdateRemoveOp | ImageLibraryUpdateUpdateOp

export interface ImageLibraryUpdateRemoveOp {
	type: 'remove'
	itemId: string
}

export interface ImageLibraryUpdateUpdateOp {
	type: 'update'
	itemId: string
	info: ImageLibraryInfo
}
