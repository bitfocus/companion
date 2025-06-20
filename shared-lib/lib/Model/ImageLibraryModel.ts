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

export interface ImageLibraryExportData {
	info: ImageLibraryInfo
	originalImage: string // base64 data URL
	previewImage: string // base64 data URL
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
