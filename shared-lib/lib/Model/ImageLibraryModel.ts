import type { CollectionBase } from './Collections.js'

export interface ImageLibraryInfo {
	name: string
	description: string
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

export type ImageLibraryCollection = CollectionBase<null>

export type ImageLibraryUpdate = ImageLibraryUpdateInitOp | ImageLibraryUpdateRemoveOp | ImageLibraryUpdateUpdateOp

export interface ImageLibraryUpdateInitOp {
	type: 'init'
	images: ImageLibraryInfo[]
}

export interface ImageLibraryUpdateRemoveOp {
	type: 'remove'
	itemName: string
}

export interface ImageLibraryUpdateUpdateOp {
	type: 'update'
	itemName: string
	info: ImageLibraryInfo
}
